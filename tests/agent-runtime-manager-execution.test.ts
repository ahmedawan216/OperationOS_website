import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentDefinitionSchema,
  type AgentResult,
  type ExecutionSnapshot,
  type UserGoal,
} from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { ManagerExecutionLoop } from "../lib/agent-runtime/manager-execution";
import type { ManagerPlanProposal, ManagerPlanningRequest } from "../lib/agent-runtime/manager-contracts";
import { validateManagerPlan } from "../lib/agent-runtime/manager-planning";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "../lib/agent-runtime/state";
import { DeterministicFakeSpecialistExecutor, type FakeSpecialistOutcome } from "../lib/agent-runtime/testing/fake-specialist-executor";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";

const now = "2026-09-21T18:00:00.000Z";
const workflow = agentDefinitionSchema.parse({
  agentKey: "workflow_discovery_specialist", versionId: "workflow-v1", version: 1,
  role: "specialist", status: "active", purpose: "Discover workflow.", instructionTemplate: "Stub.",
  inputSchema: "assignment-v1", outputSchema: "workflow-v1",
  modelPolicy: { allowedModelKeys: ["fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 1_000, timeoutMs: 10_000 },
  capabilityGrants: [], createdBy: "test", createdAt: now,
});
const architecture = agentDefinitionSchema.parse({ ...workflow, agentKey: "agent_architecture_specialist", versionId: "architecture-v1" });
const agents = createAgentRegistry([workflow, architecture]);
const goal: UserGoal = {
  goalId: "goal-1", tenantId: "tenant-1", actorId: "actor-1", objective: "Discover a workflow.",
  inputs: { brief: "Onboarding" }, acceptanceCriteria: [{
    id: "criterion-1", description: "Workflow exists.", evaluator: "deterministic", required: true,
  }], constraints: ["No writes"], requestedAt: now, idempotencyKey: "manager-execution-goal-1",
};

function snapshot(overrides: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    executionId: "execution-1", goalId: goal.goalId, managerVersionId: "manager-v1",
    specialistVersionIds: [workflow.versionId, architecture.versionId], policyBundleVersionId: "policy-v1",
    toolVersionIds: [], modelBindings: { manager: "fake" }, maxSteps: 2, maxRetriesPerStep: 1,
    maxWallTimeMs: 30_000, maxCostUsd: 1, createdAt: now, ...overrides,
  };
}

function proposal(executionId = "execution-1"): ManagerPlanProposal {
  return {
    plan: {
      planId: "plan-1", executionId, rationaleSummary: "Use the workflow specialist.",
      steps: [{
        stepId: "workflow", sequence: 0, objective: "Discover workflow.",
        assignedAgentKey: workflow.agentKey, inputRefs: [{ kind: "goal_input", id: "brief" }],
        expectedOutputSchema: "workflow-v1", acceptanceCriterionIds: ["criterion-1"],
        requiredCapabilities: [], riskLevel: "low", dependsOn: [],
      }],
      verificationStepIds: ["workflow"],
    },
    decisionSummary: "One bounded read-only assignment is sufficient.",
  };
}

function completedResult(executionId = "execution-1"): AgentResult {
  return {
    executionId, stepId: "workflow", status: "completed", output: { stages: ["intake"] },
    evidenceRefs: [{ kind: "step_output", id: "workflow" }], confidence: 1, unmetCriteria: [],
  };
}

function setup(input: {
  outcomes: FakeSpecialistOutcome[];
  snapshot?: ExecutionSnapshot;
  nowMs?: () => number;
  cancelled?: () => boolean;
}) {
  const selectedSnapshot = input.snapshot ?? snapshot();
  const request: ManagerPlanningRequest = { goal, snapshot: selectedSnapshot, planId: "plan-1", previousPlanIds: [] };
  const validatedPlan = validateManagerPlan({ proposal: proposal(selectedSnapshot.executionId), request, agents });
  const states = new InMemoryExecutionStateStore();
  const attempts = new InMemoryStepAttemptStore();
  let eventId = 0;
  const events = new SafeTraceWriter({
    maxPayloadBytes: 2_000,
    createEventId: () => `event-${++eventId}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry([]), policies: createPolicyRegistry([]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => selectedSnapshot.executionId, now: () => now,
  });
  states.initialize(selectedSnapshot.executionId, now);
  runtime.transitionExecution(selectedSnapshot.executionId, "planning");
  let attemptId = 0;
  const specialistExecutor = new DeterministicFakeSpecialistExecutor(input.outcomes);
  const loop = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor,
    createStepAttemptId: () => `attempt-${++attemptId}`,
    now: () => now,
    nowMs: input.nowMs ?? (() => 0),
    isCancelled: input.cancelled ?? (() => false),
  });
  return { loop, states, attempts, events, specialistExecutor, validatedPlan, selectedSnapshot };
}

test("successful validated plan executes through runtime and reaches verification", async () => {
  const context = setup({ outcomes: [{ kind: "response", response: { result: completedResult(), usage: { costUsd: 0.05 } } }] });
  const result = await context.loop.execute({ goal, validatedPlan: context.validatedPlan });
  assert.equal(result.status, "ready_for_verification");
  assert.equal(context.states.get("execution-1")?.status, "verifying");
  assert.equal(context.specialistExecutor.calls.length, 1);
});

test("retry budget is enforced and failed attempt history is preserved", async () => {
  const retryableFailure: AgentResult = {
    executionId: "execution-1", stepId: "workflow", status: "failed", evidenceRefs: [],
    unmetCriteria: ["criterion-1"], error: { code: "PROVIDER_ERROR", message: "Temporary failure", retryable: true },
  };
  const context = setup({ outcomes: [
    { kind: "response", response: { result: retryableFailure } },
    { kind: "response", response: { result: completedResult() } },
  ] });
  const result = await context.loop.execute({ goal, validatedPlan: context.validatedPlan });
  assert.equal(result.status, "ready_for_verification");
  const attempts = context.attempts.listForStep("execution-1", "workflow");
  assert.deepEqual(attempts.map((attempt) => attempt.status), ["failed", "succeeded"]);
  assert.equal(attempts[1]?.retryOfStepAttemptId, attempts[0]?.stepAttemptId);

  const exhausted = setup({ outcomes: [
    { kind: "response", response: { result: retryableFailure } },
    { kind: "response", response: { result: retryableFailure } },
  ] });
  const exhaustedResult = await exhausted.loop.execute({ goal, validatedPlan: exhausted.validatedPlan });
  assert.equal(exhaustedResult.status, "failed");
  assert.equal(exhausted.specialistExecutor.calls.length, 2);
});

test("wall-time and cost budgets fail closed", async () => {
  const times = [0, 0, 31_000];
  const timed = setup({
    outcomes: [{ kind: "response", response: { result: completedResult() } }],
    nowMs: () => times.shift() ?? 31_000,
  });
  const timedResult = await timed.loop.execute({ goal, validatedPlan: timed.validatedPlan });
  assert.equal(timedResult.status, "failed");
  if (timedResult.status === "failed") assert.equal(timedResult.error.code, "TIMEOUT");
  assert.equal(timed.specialistExecutor.calls.length, 0);

  const costly = setup({
    outcomes: [{ kind: "response", response: { result: completedResult(), usage: { costUsd: 2 } } }],
  });
  const costlyResult = await costly.loop.execute({ goal, validatedPlan: costly.validatedPlan });
  assert.equal(costlyResult.status, "failed");
  if (costlyResult.status === "failed") assert.equal(costlyResult.error.code, "BUDGET_EXCEEDED");
});

test("provider errors and invalid structured results become typed failures", async () => {
  const providerFailure = setup({ outcomes: [{ kind: "error", error: new TypeError("provider secret detail") }] });
  const providerResult = await providerFailure.loop.execute({ goal, validatedPlan: providerFailure.validatedPlan });
  assert.equal(providerResult.status, "failed");
  if (providerResult.status === "failed") {
    assert.equal(providerResult.error.code, "PROVIDER_ERROR");
    assert.equal(providerResult.error.message.includes("secret detail"), false);
  }

  const invalid = setup({ outcomes: [{ kind: "response", response: { result: { status: "completed" } } }] });
  const invalidResult = await invalid.loop.execute({ goal, validatedPlan: invalid.validatedPlan });
  assert.equal(invalidResult.status, "failed");
  if (invalidResult.status === "failed") assert.equal(invalidResult.error.code, "VALIDATION_ERROR");

  const mismatched = setup({ outcomes: [{
    kind: "response",
    response: { result: completedResult("other-execution") },
  }] });
  const mismatchedResult = await mismatched.loop.execute({ goal, validatedPlan: mismatched.validatedPlan });
  assert.equal(mismatchedResult.status, "failed");
  if (mismatchedResult.status === "failed") assert.equal(mismatchedResult.error.code, "VALIDATION_ERROR");
});

test("cancellation prevents specialist work and terminal execution cannot reopen", async () => {
  const context = setup({
    outcomes: [{ kind: "response", response: { result: completedResult() } }],
    cancelled: () => true,
  });
  const result = await context.loop.execute({ goal, validatedPlan: context.validatedPlan });
  assert.equal(result.status, "cancelled");
  assert.equal(context.specialistExecutor.calls.length, 0);
  await assert.rejects(context.loop.execute({ goal, validatedPlan: context.validatedPlan }), /planning state/);
});
