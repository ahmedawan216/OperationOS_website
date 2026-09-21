import assert from "node:assert/strict";
import { test } from "node:test";

import { agentDefinitionSchema, type AgentResult, type ExecutionSnapshot, type UserGoal } from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import type { ManagerPlanProposal, CriterionVerification } from "../lib/agent-runtime/manager-contracts";
import { validateManagerPlan } from "../lib/agent-runtime/manager-planning";
import { InMemoryOutcomeSignalStore, ManagerFinalizer, type AcceptanceCriterionVerifier } from "../lib/agent-runtime/manager-verification";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore } from "../lib/agent-runtime/state";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";
import { ContractValidationError } from "../lib/agent-runtime/validation";

const now = "2026-09-21T18:00:00.000Z";
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
    id: "criterion-1", description: "Workflow output exists.", evaluator: "deterministic", required: true,
  }], constraints: ["No writes"], requestedAt: now, idempotencyKey: "manager-verification-goal-1",
};
const snapshot: ExecutionSnapshot = {
  executionId: "execution-1", goalId: goal.goalId, managerVersionId: "manager-v1",
  specialistVersionIds: [specialist.versionId, architecture.versionId], policyBundleVersionId: "policy-v1",
  toolVersionIds: [], modelBindings: { manager: "fake" }, maxSteps: 2, maxRetriesPerStep: 1,
  maxWallTimeMs: 30_000, maxCostUsd: 1, createdAt: now,
};
const proposal: ManagerPlanProposal = {
  plan: {
    planId: "plan-1", executionId: snapshot.executionId, rationaleSummary: "Discover workflow.",
    steps: [{
      stepId: "workflow", sequence: 0, objective: "Discover workflow.", assignedAgentKey: specialist.agentKey,
      inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-v1",
      acceptanceCriterionIds: ["criterion-1"], requiredCapabilities: [], riskLevel: "low", dependsOn: [],
    }], verificationStepIds: ["workflow"],
  },
  decisionSummary: "Verify the workflow specialist output.",
};
const validatedPlan = validateManagerPlan({
  proposal,
  request: { goal, snapshot, planId: "plan-1", previousPlanIds: [] },
  agents,
});
const output: AgentResult = {
  executionId: snapshot.executionId, stepId: "workflow", status: "completed",
  output: { stages: ["intake"] }, evidenceRefs: [{ kind: "step_output", id: "workflow" }],
  confidence: 1, unmetCriteria: [],
};

class FixedVerifier implements AcceptanceCriterionVerifier {
  readonly versionId = "deterministic-verifier-v1";
  constructor(private readonly result: CriterionVerification) {}
  async verify(): Promise<unknown> { return structuredClone(this.result); }
}

function setup(verification: CriterionVerification) {
  const states = new InMemoryExecutionStateStore();
  let eventId = 0;
  const events = new SafeTraceWriter({
    maxPayloadBytes: 4_000, createEventId: () => `event-${++eventId}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry([]), policies: createPolicyRegistry([]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => snapshot.executionId, now: () => now,
  });
  states.initialize(snapshot.executionId, now);
  runtime.transitionExecution(snapshot.executionId, "planning");
  runtime.transitionExecution(snapshot.executionId, "running");
  runtime.transitionExecution(snapshot.executionId, "verifying");
  const signals = new InMemoryOutcomeSignalStore();
  let signalId = 0;
  const finalizer = new ManagerFinalizer({
    runtime, states, verifier: new FixedVerifier(verification), signals, events,
    createSignalId: () => `signal-${++signalId}`, now: () => now,
  });
  return { finalizer, states, signals, events };
}

test("verified required criteria produce a typed success and outcome signals", async () => {
  const context = setup({
    criterionId: "criterion-1", satisfied: true,
    evidenceRefs: [{ kind: "step_output", id: "workflow" }], summary: "Workflow output is present.",
  });
  const result = await context.finalizer.finalize({
    goal, plan: validatedPlan,
    progress: { status: "ready_for_verification", outputs: { workflow: output }, costUsd: 0.08 },
    durationMs: 250,
  });
  assert.equal(result.status, "succeeded");
  assert.equal(context.states.get(snapshot.executionId)?.status, "succeeded");
  assert.deepEqual(
    context.signals.list(snapshot.executionId).map((signal) => signal.metricKey),
    ["goal_success", "criterion_score", "latency_ms", "cost_usd"],
  );
  const traceText = JSON.stringify(context.events.list(snapshot.executionId));
  assert.equal(/chain.of.thought|hiddenReasoning|internalReasoning/i.test(traceText), false);
});

test("fabricated verifier evidence cannot satisfy a required criterion", async () => {
  const context = setup({
    criterionId: "criterion-1", satisfied: true,
    evidenceRefs: [{ kind: "artifact", id: "fabricated" }], summary: "Claimed without runtime evidence.",
  });
  const result = await context.finalizer.finalize({
    goal, plan: validatedPlan,
    progress: { status: "ready_for_verification", outputs: { workflow: output }, costUsd: 0 },
    durationMs: 100,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "VERIFICATION_FAILED");
  assert.equal(result.verification.criteria[0]?.satisfied, false);
  assert.equal(context.states.get(snapshot.executionId)?.status, "failed");
});

test("evidence from a non-verification step cannot satisfy a required criterion", async () => {
  const context = setup({
    criterionId: "criterion-1", satisfied: true,
    evidenceRefs: [{ kind: "step_output", id: "other-step" }], summary: "Evidence came from an undeclared step.",
  });
  const result = await context.finalizer.finalize({
    goal, plan: validatedPlan,
    progress: {
      status: "ready_for_verification",
      outputs: {
        workflow: output,
        "other-step": { ...output, stepId: "other-step", evidenceRefs: [{ kind: "step_output", id: "other-step" }] },
      },
      costUsd: 0,
    },
    durationMs: 100,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.verification.criteria[0]?.satisfied, false);
});

test("failed verification prevents successful execution", async () => {
  const context = setup({
    criterionId: "criterion-1", satisfied: false, evidenceRefs: [], summary: "Required output is absent.",
  });
  const result = await context.finalizer.finalize({
    goal, plan: validatedPlan,
    progress: { status: "ready_for_verification", outputs: { workflow: output }, costUsd: 0 },
    durationMs: 100,
  });
  assert.equal(result.status, "failed");
  assert.equal(context.signals.list(snapshot.executionId)[0]?.value, 0);
});

test("a satisfied claim without evidence is rejected at the verifier boundary", async () => {
  const context = setup({
    criterionId: "criterion-1", satisfied: true, evidenceRefs: [], summary: "Unsupported claim.",
  });
  await assert.rejects(
    context.finalizer.finalize({
      goal, plan: validatedPlan,
      progress: { status: "ready_for_verification", outputs: { workflow: output }, costUsd: 0 },
      durationMs: 100,
    }),
    ContractValidationError,
  );
  assert.equal(context.states.get(snapshot.executionId)?.status, "verifying");
});
