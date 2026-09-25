import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryApprovalLedger } from "../lib/agent-runtime/approvals";
import {
  agentDefinitionSchema,
  approvalRequestSchema,
  type ExecutionSnapshot,
  type RuntimeError,
  type UserGoal,
} from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { type ManagerPlanProposal } from "../lib/agent-runtime/manager-contracts";
import { classifyManagerPlanRejection, InMemoryPlanHistoryStore, ManagerApprovalGate, ManagerPlanningCoordinator } from "../lib/agent-runtime/manager-recovery";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore } from "../lib/agent-runtime/state";
import { DeterministicFakeManagerProvider } from "../lib/agent-runtime/testing/fake-manager-provider";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";

const now = "2026-09-21T18:00:00.000Z";
const digest = `sha256:${"a".repeat(64)}`;
const specialist = agentDefinitionSchema.parse({
  agentKey: "workflow_discovery_specialist", versionId: "workflow-v1", version: 1,
  role: "specialist", status: "active", purpose: "Discover workflow.", instructionTemplate: "Stub.",
  inputSchema: "assignment-v1", outputSchema: "workflow-v1",
  modelPolicy: { allowedModelKeys: ["fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 1_000, timeoutMs: 10_000 },
  capabilityGrants: [], createdBy: "test", createdAt: now,
});
const architecture = agentDefinitionSchema.parse({ ...specialist, agentKey: "agent_architecture_specialist", versionId: "architecture-v1" });
const agents = createAgentRegistry([specialist, architecture]);
const goal: UserGoal = {
  goalId: "goal-1", tenantId: "tenant-1", actorId: "actor-1", objective: "Discover workflow.",
  inputs: { brief: "Onboarding" }, acceptanceCriteria: [{
    id: "criterion-1", description: "Workflow exists.", evaluator: "deterministic", required: true,
  }], constraints: ["No writes"], requestedAt: now, idempotencyKey: "manager-recovery-goal-1",
};
const snapshot: ExecutionSnapshot = {
  executionId: "execution-1", goalId: goal.goalId, managerVersionId: "manager-v1",
  specialistVersionIds: [specialist.versionId, architecture.versionId], policyBundleVersionId: "policy-v1",
  toolVersionIds: [], modelBindings: { manager: "fake" }, maxSteps: 3, maxRetriesPerStep: 1,
  maxWallTimeMs: 30_000, maxCostUsd: 1, createdAt: now,
};

function proposal(planId: string, stepId: string): ManagerPlanProposal {
  return {
    plan: {
      planId, executionId: snapshot.executionId, rationaleSummary: "Use one bounded specialist step.",
      steps: [{
        stepId, sequence: 0, objective: "Discover workflow.", assignedAgentKey: specialist.agentKey,
        inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-v1",
        acceptanceCriterionIds: ["criterion-1"], requiredCapabilities: [], riskLevel: "low", dependsOn: [],
      }],
      verificationStepIds: [stepId],
    },
    decisionSummary: "A single read-only specialist step is sufficient.",
  };
}

function traceWriter() {
  let id = 0;
  return new SafeTraceWriter({
    maxPayloadBytes: 2_000, createEventId: () => `event-${++id}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
}

test("bounded replanning preserves immutable prior plan history", async () => {
  const provider = new DeterministicFakeManagerProvider([
    { kind: "response", response: { output: proposal("plan-1", "step-original") } },
    { kind: "response", response: { output: proposal("plan-2", "step-recovery") } },
  ]);
  const history = new InMemoryPlanHistoryStore();
  const ids = ["plan-1", "plan-2"];
  const coordinator = new ManagerPlanningCoordinator({
    provider, agents, history, events: traceWriter(), createPlanId: () => ids.shift()!, now: () => now, maxReplans: 1,
  });
  const initial = await coordinator.createInitial({ goal, snapshot });
  assert.equal(initial.status, "planned");
  const failure: RuntimeError = { code: "PROVIDER_ERROR", message: "Specialist failed", retryable: true };
  const recovery = await coordinator.replan({ goal, snapshot, failedStepId: "step-original", error: failure, evidenceRefs: ["event-1"] });
  assert.equal(recovery.status, "planned");

  const records = history.list(snapshot.executionId);
  assert.deepEqual(records.map((record) => record.planId), ["plan-1", "plan-2"]);
  assert.equal(records[0]?.plan.plan.steps[0]?.stepId, "step-original");
  assert.equal(records[1]?.previousPlanId, "plan-1");
  assert.deepEqual(provider.requests[1]?.previousPlanIds, ["plan-1"]);
  assert.equal(provider.requests[1]?.recovery?.failedStepId, "step-original");

  const overBudget = await coordinator.replan({ goal, snapshot, failedStepId: "step-recovery", error: failure, evidenceRefs: [] });
  assert.equal(overBudget.status, "failed");
  if (overBudget.status === "failed") assert.equal(overBudget.error.code, "BUDGET_EXCEEDED");
  assert.equal(provider.requests.length, 2);
});

test("invalid replanning output follows a typed failure path and is not stored", async () => {
  const provider = new DeterministicFakeManagerProvider([{
    kind: "response", response: { output: { plan: { planId: "plan-invalid" } } },
  }]);
  const history = new InMemoryPlanHistoryStore();
  const events = traceWriter();
  const coordinator = new ManagerPlanningCoordinator({
    provider, agents, history, events, createPlanId: () => "plan-invalid", now: () => now, maxReplans: 1,
  });
  const result = await coordinator.createInitial({ goal, snapshot });
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(history.list(snapshot.executionId).length, 0);
  const response = events.list(snapshot.executionId).find((item) => item.type === "model.responded");
  assert.equal(response?.payload.validationBoundary, "provider_plan_contract");
  assert.equal(JSON.stringify(response?.payload).includes("hiddenReasoning"), false);
});

test("semantic Manager plan rejection records only a fixed, privacy-safe reason code", async () => {
  const invalid = proposal("plan-mismatch", "step-1");
  const provider = new DeterministicFakeManagerProvider([{ kind: "response", response: { output: invalid } }]);
  const events = traceWriter();
  const coordinator = new ManagerPlanningCoordinator({ provider, agents, history: new InMemoryPlanHistoryStore(),
    events, createPlanId: () => "plan-expected", now: () => now, maxReplans: 0 });
  const result = await coordinator.createInitial({ goal, snapshot });
  assert.equal(result.status, "failed");
  const response = events.list(snapshot.executionId).find((item) => item.type === "model.responded");
  assert.equal(response?.payload.validationBoundary, "runtime_plan");
  assert.equal(response?.payload.validationReason, "PLAN_ID_MISMATCH");
  assert.equal(JSON.stringify(response?.payload).includes("plan-mismatch"), false);
  assert.equal(classifyManagerPlanRejection(new Error("Manager cannot grant unauthorized capability: secret")), "CAPABILITY_NOT_GRANTED");
  assert.equal(classifyManagerPlanRejection(new Error("secret from provider")), "OTHER_RUNTIME_PLAN_REJECTION");
});

test("Manager provider errors are normalized without leaking provider details", async () => {
  const provider = new DeterministicFakeManagerProvider([{
    kind: "error", error: new Error("sensitive upstream response"),
  }]);
  const history = new InMemoryPlanHistoryStore();
  const coordinator = new ManagerPlanningCoordinator({
    provider, agents, history, events: traceWriter(), createPlanId: () => "plan-error", now: () => now, maxReplans: 1,
  });
  const result = await coordinator.createInitial({ goal, snapshot });
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.error.code, "PROVIDER_ERROR");
    assert.equal(result.error.message.includes("sensitive upstream response"), false);
  }
  assert.equal(history.list(snapshot.executionId).length, 0);
});

function approvalContext(status: "approved" | "rejected" = "approved", expiresAt = "2026-09-21T19:00:00.000Z") {
  const states = new InMemoryExecutionStateStore();
  const events = traceWriter();
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry([]), policies: createPolicyRegistry([]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => snapshot.executionId, now: () => now,
  });
  states.initialize(snapshot.executionId, now);
  runtime.transitionExecution(snapshot.executionId, "planning");
  runtime.transitionExecution(snapshot.executionId, "running");
  runtime.transitionExecution(snapshot.executionId, "awaiting_approval");
  const approvals = new InMemoryApprovalLedger();
  approvals.add(approvalRequestSchema.parse({
    approvalId: "approval-1", executionId: snapshot.executionId, requestedBy: "manager-runtime",
    actorId: goal.actorId, actionType: "specialist.resume", riskLevel: "high",
    approvalType: "explicit_human", actionDigest: digest, summary: "Resume consequential step.",
    expiresAt, status,
  }));
  const gate = new ManagerApprovalGate({ runtime, states, approvals, events, now: () => now });
  return { gate, states, approvals };
}

test("approval-required execution resumes only with the exact valid single-use approval", () => {
  const context = approvalContext();
  const resumed = context.gate.resume({ executionId: snapshot.executionId, approvalId: "approval-1", actorId: goal.actorId, actionDigest: digest });
  assert.equal(resumed.status, "resumed");
  assert.equal(context.states.get(snapshot.executionId)?.status, "running");
  assert.equal(context.approvals.get("approval-1")?.status, "consumed");

  const replay = context.gate.resume({ executionId: snapshot.executionId, approvalId: "approval-1", actorId: goal.actorId, actionDigest: digest });
  assert.equal(replay.status, "blocked");
});

test("rejected, expired, actor-mismatched, and digest-mismatched approvals cannot resume", () => {
  const cases = [
    { context: approvalContext("rejected"), actorId: goal.actorId, actionDigest: digest },
    { context: approvalContext("approved", "2026-09-21T17:00:00.000Z"), actorId: goal.actorId, actionDigest: digest },
    { context: approvalContext(), actorId: "other-actor", actionDigest: digest },
    { context: approvalContext(), actorId: goal.actorId, actionDigest: `sha256:${"b".repeat(64)}` },
  ];
  for (const testCase of cases) {
    const result = testCase.context.gate.resume({
      executionId: snapshot.executionId, approvalId: "approval-1",
      actorId: testCase.actorId, actionDigest: testCase.actionDigest,
    });
    assert.equal(result.status, "blocked");
    assert.equal(testCase.context.states.get(snapshot.executionId)?.status, "awaiting_approval");
  }
});
