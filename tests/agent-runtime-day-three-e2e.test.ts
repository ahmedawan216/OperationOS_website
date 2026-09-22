import assert from "node:assert/strict";
import { test } from "node:test";

import type { AcceptanceCriterion, UserGoal } from "../lib/agent-runtime/contracts";
import { AgentArchitectureSpecialist } from "../lib/agent-runtime/agent-architecture-specialist";
import { dayThreeAgentFixtures } from "../lib/agent-runtime/day-three-fixtures";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { dayOnePolicyFixture } from "../lib/agent-runtime/fixtures";
import { ManagerExecutionLoop } from "../lib/agent-runtime/manager-execution";
import type { ManagerPlanProposal } from "../lib/agent-runtime/manager-contracts";
import { InMemoryPlanHistoryStore, ManagerPlanningCoordinator } from "../lib/agent-runtime/manager-recovery";
import { ManagerOrchestrationService } from "../lib/agent-runtime/manager-service";
import { InMemoryOutcomeSignalStore, ManagerFinalizer, type AcceptanceCriterionVerifier } from "../lib/agent-runtime/manager-verification";
import { resolveProductSnapshot } from "../lib/agent-runtime/product-registry";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemorySpecialistContextStore } from "../lib/agent-runtime/specialist-context";
import { RegisteredWorkflowModelVerifier, SpecialistExecutionRouter } from "../lib/agent-runtime/specialist-router";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "../lib/agent-runtime/state";
import { DeterministicFakeManagerProvider } from "../lib/agent-runtime/testing/fake-manager-provider";
import { DeterministicSpecialistProvider, type FakeSpecialistProviderOutcome } from "../lib/agent-runtime/testing/fake-specialist-provider";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";
import { WorkflowDiscoverySpecialist } from "../lib/agent-runtime/workflow-discovery-specialist";
import { architectureProposal, workflowInput, workflowModel } from "./fixtures/specialist-fixtures";
import { productRegistries, productToolFixtures } from "./fixtures/product-fixtures";

const now = "2026-09-22T00:00:00.000Z";
const executionId = "execution-1";
const manager = dayThreeAgentFixtures.find((agent) => agent.agentKey === "manager")!;
const workflowAgent = dayThreeAgentFixtures.find((agent) => agent.agentKey === "workflow_discovery_specialist")!;
const architectureAgent = dayThreeAgentFixtures.find((agent) => agent.agentKey === "agent_architecture_specialist")!;
const goal: UserGoal = {
  goalId: "goal-1", tenantId: "tenant-1", actorId: "operator-1",
  objective: "Model customer onboarding and propose its bounded agent architecture.",
  inputs: { brief: "An operator reviews a supplied onboarding request and records a decision." },
  acceptanceCriteria: [{
    id: "criterion-decision", description: "A workflow-grounded architecture proposal exists.",
    evaluator: "deterministic", required: true,
  }],
  constraints: ["Read only", "Proposal only", "Human authority remains final"],
  requestedAt: now, idempotencyKey: "day-three-e2e-goal-1",
};

function plan(): ManagerPlanProposal {
  return {
    plan: {
      planId: "day-three-plan-1", executionId,
      rationaleSummary: "Discover and verify the workflow before proposing an architecture.",
      steps: [
        {
          stepId: "workflow-step", sequence: 0, objective: "Discover the onboarding workflow.",
          assignedAgentKey: "workflow_discovery_specialist",
          inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-model-v1",
          acceptanceCriterionIds: [], requiredCapabilities: [], riskLevel: "low", dependsOn: [],
        },
        {
          stepId: "architecture-step", sequence: 1, objective: "Propose the bounded architecture.",
          assignedAgentKey: "agent_architecture_specialist",
          inputRefs: [{ kind: "step_output", id: "workflow-step" }], expectedOutputSchema: "agent-system-proposal-v1",
          acceptanceCriterionIds: ["criterion-decision"], requiredCapabilities: [], riskLevel: "low",
          dependsOn: ["workflow-step"],
        },
      ],
      verificationStepIds: ["architecture-step"],
    },
    decisionSummary: "Use the two registered specialists in dependency order.",
  };
}

class ArchitectureEvidenceVerifier implements AcceptanceCriterionVerifier {
  readonly versionId = "day-three-architecture-output-verifier-v1";
  async verify(input: { criterion: AcceptanceCriterion }): Promise<unknown> {
    return {
      criterionId: input.criterion.id, satisfied: true,
      evidenceRefs: [{ kind: "step_output", id: "architecture-step" }],
      summary: "The declared architecture verification step produced a validated proposal.",
    };
  }
}

function setup(providerOutcomes: {
  workflow: readonly FakeSpecialistProviderOutcome[];
  architecture: readonly FakeSpecialistProviderOutcome[];
}) {
  const agents = createAgentRegistry(dayThreeAgentFixtures);
  const states = new InMemoryExecutionStateStore();
  const attempts = new InMemoryStepAttemptStore();
  const history = new InMemoryPlanHistoryStore();
  const signals = new InMemoryOutcomeSignalStore();
  let eventId = 0;
  const events = new SafeTraceWriter({
    maxPayloadBytes: 8_000, createEventId: () => `day-three-event-${++eventId}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry(productToolFixtures), policies: createPolicyRegistry([dayOnePolicyFixture]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => executionId, now: () => now,
  });
  const productContext = resolveProductSnapshot({
    productSnapshotId: "product-snapshot-1",
    manifest: {
      productVersionId: "operations-suite-product-v1", featureVersionIds: ["onboarding-feature-v1"],
      capabilityVersionIds: ["onboarding-record-read-capability-v1"], workflowVersionIds: ["onboarding-workflow-v1"],
      toolVersionIds: ["onboarding-record-read-tool-v1"], signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
      evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"],
    },
    registries: productRegistries(), createdAt: now,
  });
  const contexts = new InMemorySpecialistContextStore();
  contexts.registerWorkflowContext({
    executionId, goal: workflowInput().goal, evidence: workflowInput().evidence,
    declaredCapabilityKeys: productContext.capabilities.map((item) => item.capabilityKey),
  });
  const specialistProvider = new DeterministicSpecialistProvider(providerOutcomes);
  const workflow = new WorkflowDiscoverySpecialist({ provider: specialistProvider, contexts, events, now: () => now });
  const architecture = new AgentArchitectureSpecialist({ provider: specialistProvider, contexts, events, now: () => now });
  const router = new SpecialistExecutionRouter({
    workflow, architecture, contexts,
    products: {
      resolveProductContext: (requestedExecutionId) => {
        if (requestedExecutionId !== executionId) throw new Error("Unknown execution product context");
        return productContext;
      },
    },
    workflowVerifier: new RegisteredWorkflowModelVerifier(), events, now: () => now,
  });
  const managerProvider = new DeterministicFakeManagerProvider([{
    kind: "response", response: { output: plan(), usage: { costUsd: 0.01 } },
  }]);
  const planning = new ManagerPlanningCoordinator({
    provider: managerProvider, agents, history, events,
    createPlanId: () => "day-three-plan-1", now: () => now, maxReplans: 0,
  });
  let attemptId = 0;
  const execution = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor: router,
    createStepAttemptId: () => `day-three-attempt-${++attemptId}`,
    now: () => now, nowMs: () => 100, isCancelled: () => false,
  });
  let signalId = 0;
  const finalizer = new ManagerFinalizer({
    runtime, states, verifier: new ArchitectureEvidenceVerifier(), signals, events,
    createSignalId: () => `day-three-signal-${++signalId}`, now: () => now,
  });
  const service = new ManagerOrchestrationService({ runtime, states, planning, execution, finalizer, nowMs: () => 100 });
  return { service, states, attempts, history, signals, events, specialistProvider, productContext };
}

test("real specialists complete the Manager flow with verified provenance and a typed final result", async () => {
  const context = setup({
    workflow: [{ kind: "response", response: { output: workflowModel(), usage: { costUsd: 0.01 } } }],
    architecture: [{ kind: "response", response: { output: architectureProposal(), usage: { costUsd: 0.01 } } }],
  });
  const result = await context.service.run({
    goal,
    manifest: {
      managerVersionId: manager.versionId,
      specialistVersionIds: [workflowAgent.versionId, architectureAgent.versionId],
      policyBundleVersionId: dayOnePolicyFixture.versionId,
      toolVersionIds: ["onboarding-record-read-tool-v1"], modelBindings: { manager: "deterministic-fake" },
    },
    budget: { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 30_000, maxCostUsd: 1 },
  });

  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw new Error("Expected completed Day 3 fixture");
  assert.equal(result.result.status, "succeeded");
  assert.equal((result.result.outputs["workflow-step"]?.output as { status: string }).status, "draft");
  assert.equal((result.result.outputs["architecture-step"]?.output as { status: string }).status, "proposal");
  assert.equal(context.specialistProvider.workflowRequests.length, 1);
  assert.equal(context.specialistProvider.architectureRequests.length, 1);
  assert.equal(context.specialistProvider.architectureRequests[0]?.verifiedWorkflowModel.workflowId, "workflow-1");
  assert.deepEqual(context.specialistProvider.architectureRequests[0]?.assignment.contextRefs, [
    { kind: "step_output", id: "workflow-step" },
  ]);
  assert.equal(context.signals.list(executionId).some((signal) => signal.metricKey === "goal_success" && signal.value === 1), true);
  const traces = context.events.list(executionId);
  assert.equal(traces.filter((event) => event.type === "step.completed").length, 2);
  assert.equal(traces.filter((event) => event.type === "model.requested").length, 3);
  assert.equal(/chain.of.thought|hiddenReasoning|internalReasoning/i.test(JSON.stringify(traces)), false);
});

test("a failed workflow prerequisite prevents architecture execution", async () => {
  const context = setup({
    workflow: [{ kind: "error", error: new Error("raw provider detail") }],
    architecture: [{ kind: "response", response: { output: architectureProposal() } }],
  });
  const result = await context.service.run({
    goal,
    manifest: {
      managerVersionId: manager.versionId,
      specialistVersionIds: [workflowAgent.versionId, architectureAgent.versionId],
      policyBundleVersionId: dayOnePolicyFixture.versionId,
      toolVersionIds: ["onboarding-record-read-tool-v1"], modelBindings: { manager: "deterministic-fake" },
    },
    budget: { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 30_000, maxCostUsd: 1 },
  });
  assert.equal(result.status, "failed");
  assert.equal(context.specialistProvider.architectureRequests.length, 0);
  assert.equal(context.attempts.listForStep(executionId, "workflow-step")[0]?.status, "failed");
  assert.equal(context.states.get(executionId)?.status, "failed");
});
