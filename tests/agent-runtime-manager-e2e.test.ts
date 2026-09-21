import assert from "node:assert/strict";
import { test } from "node:test";

import type { AcceptanceCriterion, AgentResult, RuntimeError, UserGoal } from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { dayOnePolicyFixture } from "../lib/agent-runtime/fixtures";
import { ManagerExecutionLoop } from "../lib/agent-runtime/manager-execution";
import { dayTwoManagerAgentFixtures } from "../lib/agent-runtime/manager-fixtures";
import type { ManagerPlanProposal } from "../lib/agent-runtime/manager-contracts";
import { InMemoryPlanHistoryStore, ManagerPlanningCoordinator } from "../lib/agent-runtime/manager-recovery";
import { ManagerOrchestrationService } from "../lib/agent-runtime/manager-service";
import { InMemoryOutcomeSignalStore, ManagerFinalizer, type AcceptanceCriterionVerifier } from "../lib/agent-runtime/manager-verification";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "../lib/agent-runtime/state";
import { DeterministicFakeManagerProvider, type FakeManagerProviderOutcome } from "../lib/agent-runtime/testing/fake-manager-provider";
import { DeterministicFakeSpecialistExecutor, type FakeSpecialistOutcome } from "../lib/agent-runtime/testing/fake-specialist-executor";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";

const now = "2026-09-21T18:00:00.000Z";
const executionId = "execution-manager-e2e";
const goal: UserGoal = {
  goalId: "goal-manager-e2e", tenantId: "tenant-1", actorId: "actor-1",
  objective: "Discover the onboarding workflow and propose its agent architecture.",
  inputs: { brief: "Customers submit details, the team reviews them, then sends an outcome." },
  acceptanceCriteria: [{
    id: "criterion-architecture", description: "A workflow-grounded agent architecture is present.",
    evaluator: "deterministic", required: true,
  }],
  constraints: ["No external actions", "Human approval remains authoritative"],
  requestedAt: now, idempotencyKey: "manager-e2e-goal-attempt-1",
};
const manager = dayTwoManagerAgentFixtures.find((agent) => agent.role === "manager")!;
const workflow = dayTwoManagerAgentFixtures.find((agent) => agent.agentKey === "workflow_discovery_specialist")!;
const architecture = dayTwoManagerAgentFixtures.find((agent) => agent.agentKey === "agent_architecture_specialist")!;

function twoStepProposal(): ManagerPlanProposal {
  return {
    plan: {
      planId: "plan-1", executionId, rationaleSummary: "Discover the workflow before designing its architecture.",
      steps: [
        {
          stepId: "workflow", sequence: 0, objective: "Discover the supplied onboarding workflow.",
          assignedAgentKey: workflow.agentKey, inputRefs: [{ kind: "goal_input", id: "brief" }],
          expectedOutputSchema: "workflow-model-v1", acceptanceCriterionIds: [], requiredCapabilities: [],
          riskLevel: "low", dependsOn: [],
        },
        {
          stepId: "architecture", sequence: 1, objective: "Propose a bounded architecture from the workflow.",
          assignedAgentKey: architecture.agentKey, inputRefs: [{ kind: "step_output", id: "workflow" }],
          expectedOutputSchema: "agent-architecture-v1", acceptanceCriterionIds: ["criterion-architecture"],
          requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow"],
        },
      ],
      verificationStepIds: ["architecture"],
    },
    decisionSummary: "Workflow evidence must precede the architecture proposal.",
  };
}

function singleStepProposal(planId: string, stepId: string): ManagerPlanProposal {
  return {
    plan: {
      planId, executionId, rationaleSummary: "Use one bounded recovery step.",
      steps: [{
        stepId, sequence: 0, objective: "Produce the verified architecture.",
        assignedAgentKey: architecture.agentKey, inputRefs: [{ kind: "goal_input", id: "brief" }],
        expectedOutputSchema: "agent-architecture-v1", acceptanceCriterionIds: ["criterion-architecture"],
        requiredCapabilities: [], riskLevel: "low", dependsOn: [],
      }],
      verificationStepIds: [stepId],
    },
    decisionSummary: "Use a new recovery step while preserving the failed plan.",
  };
}

class EvidenceVerifier implements AcceptanceCriterionVerifier {
  readonly versionId = "day-two-deterministic-verifier-v1";
  constructor(private readonly evidenceStepId: string) {}
  async verify(input: { criterion: AcceptanceCriterion }): Promise<unknown> {
    return {
      criterionId: input.criterion.id,
      satisfied: true,
      evidenceRefs: [{ kind: "step_output", id: this.evidenceStepId }],
      summary: "The required architecture output was produced by the declared verification step.",
    };
  }
}

function completed(stepId: string, output: unknown): AgentResult {
  return {
    executionId, stepId, status: "completed", output,
    evidenceRefs: [{ kind: "step_output", id: stepId }], confidence: 1, unmetCriteria: [],
  };
}

function setup(input: {
  managerOutcomes: FakeManagerProviderOutcome[];
  specialistOutcomes: FakeSpecialistOutcome[];
  planIds: string[];
  verifierStepId: string;
  maxRetriesPerStep?: number;
  maxSteps?: number;
  maxReplans?: number;
}) {
  const agents = createAgentRegistry(dayTwoManagerAgentFixtures);
  const states = new InMemoryExecutionStateStore();
  const attempts = new InMemoryStepAttemptStore();
  const history = new InMemoryPlanHistoryStore();
  const signals = new InMemoryOutcomeSignalStore();
  let eventId = 0;
  const events = new SafeTraceWriter({
    maxPayloadBytes: 8_000, createEventId: () => `event-${++eventId}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry([]), policies: createPolicyRegistry([dayOnePolicyFixture]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => executionId, now: () => now,
  });
  const managerProvider = new DeterministicFakeManagerProvider(input.managerOutcomes);
  const ids = [...input.planIds];
  const planning = new ManagerPlanningCoordinator({
    provider: managerProvider, agents, history, events,
    createPlanId: () => ids.shift()!, now: () => now, maxReplans: input.maxReplans ?? 1,
  });
  const specialistExecutor = new DeterministicFakeSpecialistExecutor(input.specialistOutcomes);
  let attemptId = 0;
  const execution = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor,
    createStepAttemptId: () => `attempt-${++attemptId}`, now: () => now,
    nowMs: () => 100, isCancelled: () => false,
  });
  let signalId = 0;
  const finalizer = new ManagerFinalizer({
    runtime, states, verifier: new EvidenceVerifier(input.verifierStepId), signals, events,
    createSignalId: () => `signal-${++signalId}`, now: () => now,
  });
  const service = new ManagerOrchestrationService({
    runtime, states, planning, execution, finalizer, nowMs: () => 100,
  });
  return {
    service, states, attempts, history, signals, events, managerProvider, specialistExecutor,
    manifest: {
      managerVersionId: manager.versionId,
      specialistVersionIds: [workflow.versionId, architecture.versionId] as const,
      policyBundleVersionId: dayOnePolicyFixture.versionId,
      toolVersionIds: [], modelBindings: { manager: "deterministic-fake" },
    },
    budget: {
      maxSteps: input.maxSteps ?? 4, maxRetriesPerStep: input.maxRetriesPerStep ?? 1,
      maxWallTimeMs: 30_000, maxCostUsd: 1,
    },
  };
}

test("fixture goal completes the full Manager orchestration path", async () => {
  const context = setup({
    managerOutcomes: [{ kind: "response", response: { output: twoStepProposal(), usage: { costUsd: 0.01 } } }],
    specialistOutcomes: [
      { kind: "response", response: { result: completed("workflow", { stages: ["intake", "review", "outcome"] }), usage: { costUsd: 0.01 } } },
      { kind: "response", response: { result: completed("architecture", { agents: ["workflow", "architecture"] }), usage: { costUsd: 0.01 } } },
    ],
    planIds: ["plan-1"], verifierStepId: "architecture",
  });
  const result = await context.service.run({ goal, manifest: context.manifest, budget: context.budget });
  assert.equal(result.status, "completed");
  if (result.status === "completed") assert.equal(result.result.status, "succeeded");
  assert.equal(context.states.get(executionId)?.status, "succeeded");
  assert.equal(context.managerProvider.requests.length, 1);
  assert.equal(context.specialistExecutor.calls.length, 2);
  assert.equal(context.signals.list(executionId).some((signal) => signal.metricKey === "goal_success" && signal.value === 1), true);

  const types = context.events.list(executionId).map((event) => event.type);
  for (const requiredType of [
    "execution.created", "plan.created", "step.started", "step.completed",
    "verification.completed", "outcome.recorded", "execution.state_changed",
  ]) assert.equal(types.includes(requiredType as typeof types[number]), true);
  assert.equal(/chain.of.thought|hiddenReasoning|internalReasoning/i.test(JSON.stringify(context.events.list(executionId))), false);
});

test("retryable execution failure triggers one bounded replan with immutable history", async () => {
  const retryable: RuntimeError = { code: "PROVIDER_ERROR", message: "Temporary specialist failure", retryable: true };
  const context = setup({
    managerOutcomes: [
      { kind: "response", response: { output: singleStepProposal("plan-1", "initial-step") } },
      { kind: "response", response: { output: singleStepProposal("plan-2", "recovery-step") } },
    ],
    specialistOutcomes: [
      { kind: "response", response: { result: {
        executionId, stepId: "initial-step", status: "failed", evidenceRefs: [],
        unmetCriteria: ["criterion-architecture"], error: retryable,
      } } },
      { kind: "response", response: { result: completed("recovery-step", { agents: ["architecture"] }) } },
    ],
    planIds: ["plan-1", "plan-2"], verifierStepId: "recovery-step",
    maxRetriesPerStep: 0, maxSteps: 2, maxReplans: 1,
  });
  const result = await context.service.run({ goal, manifest: context.manifest, budget: context.budget });
  assert.equal(result.status, "completed");
  assert.deepEqual(context.history.list(executionId).map((record) => record.planId), ["plan-1", "plan-2"]);
  assert.deepEqual(context.attempts.listForStep(executionId, "initial-step").map((attempt) => attempt.status), ["failed"]);
  assert.equal(context.events.list(executionId).some((event) => event.type === "plan.revised"), true);
});
