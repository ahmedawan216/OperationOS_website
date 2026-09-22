import assert from "node:assert/strict";
import { test } from "node:test";

import { agentDefinitionSchema, type AgentAssignment, type ExecutionSnapshot, type UserGoal } from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { dayOnePolicyFixture } from "../lib/agent-runtime/fixtures";
import { ManagerExecutionLoop } from "../lib/agent-runtime/manager-execution";
import type { ManagerPlanningRequest } from "../lib/agent-runtime/manager-contracts";
import { validateManagerPlan } from "../lib/agent-runtime/manager-planning";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemorySpecialistContextStore } from "../lib/agent-runtime/specialist-context";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "../lib/agent-runtime/state";
import { DeterministicSpecialistProvider } from "../lib/agent-runtime/testing/fake-specialist-provider";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";
import { WorkflowDiscoverySpecialist } from "../lib/agent-runtime/workflow-discovery-specialist";
import { workflowInput, workflowModel } from "./fixtures/specialist-fixtures";

const now = "2026-09-22T00:00:00.000Z";
const workflowAgent = agentDefinitionSchema.parse({
  agentKey: "workflow_discovery_specialist", versionId: "workflow-specialist-day-three-v1", version: 1,
  role: "specialist", status: "active", purpose: "Discover a bounded workflow.",
  instructionTemplate: "Return structured facts, assumptions, unknowns, and evidence references only.",
  inputSchema: "workflow-discovery-input-v1", outputSchema: "workflow-model-v1",
  modelPolicy: { allowedModelKeys: ["deterministic-fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 8_000, timeoutMs: 30_000 },
  capabilityGrants: [], createdBy: "operationos", createdAt: now,
});
const architectureAgent = agentDefinitionSchema.parse({
  ...workflowAgent, agentKey: "agent_architecture_specialist", versionId: "architecture-specialist-day-three-v1",
  purpose: "Propose only.", inputSchema: "agent-architecture-input-v1", outputSchema: "agent-system-proposal-v1",
});

function assignment(): AgentAssignment {
  return workflowInput().assignment;
}

function traceWriter() {
  let id = 0;
  return new SafeTraceWriter({
    maxPayloadBytes: 4_000,
    createEventId: () => `workflow-event-${++id}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
}

function workflowContextStore() {
  const contexts = new InMemorySpecialistContextStore();
  contexts.registerWorkflowContext({
    executionId: "execution-1",
    goal: workflowInput().goal,
    evidence: [
      ...workflowInput().evidence,
      {
        evidenceId: "unrelated-secret", sourceKind: "goal_input" as const,
        sourceRef: { kind: "goal_input" as const, id: "unrelated-secret" },
        description: "Context not declared by this assignment.",
      },
    ],
    declaredCapabilityKeys: workflowInput().declaredCapabilityKeys,
  });
  return contexts;
}

function specialist(output = workflowModel()) {
  const provider = new DeterministicSpecialistProvider({
    workflow: [{ kind: "response", response: { output, usage: { costUsd: 0.01 } } }],
  });
  const events = traceWriter();
  return {
    provider,
    events,
    executor: new WorkflowDiscoverySpecialist({
      provider, contexts: workflowContextStore(), events, now: () => now,
    }),
  };
}

test("workflow discovery executes through the Manager/runtime path with bounded context and traces", async () => {
  const goal: UserGoal = {
    goalId: "goal-1", tenantId: "tenant-1", actorId: "actor-1", objective: "Model customer onboarding.",
    inputs: { brief: "Onboarding evidence" },
    acceptanceCriteria: [{ id: "criterion-decision", description: "A workflow decision is modeled.", evaluator: "deterministic", required: true }],
    constraints: ["Read only"], requestedAt: now, idempotencyKey: "workflow-specialist-goal-1",
  };
  const snapshot: ExecutionSnapshot = {
    executionId: "execution-1", goalId: goal.goalId, managerVersionId: "manager-day-two-v1",
    specialistVersionIds: [workflowAgent.versionId, architectureAgent.versionId],
    policyBundleVersionId: dayOnePolicyFixture.versionId, toolVersionIds: [],
    modelBindings: { manager: "deterministic-fake" }, maxSteps: 1, maxRetriesPerStep: 0,
    maxWallTimeMs: 30_000, maxCostUsd: 1, createdAt: now,
  };
  const agents = createAgentRegistry([workflowAgent, architectureAgent]);
  const request: ManagerPlanningRequest = { goal, snapshot, planId: "plan-1", previousPlanIds: [] };
  const validatedPlan = validateManagerPlan({
    agents,
    request,
    proposal: {
      plan: {
        planId: "plan-1", executionId: snapshot.executionId,
        rationaleSummary: "Discover the bounded workflow before architecture.",
        steps: [{
          stepId: "workflow-step", sequence: 0, objective: "Discover the onboarding workflow.",
          assignedAgentKey: "workflow_discovery_specialist",
          inputRefs: [{ kind: "goal_input", id: "brief" }],
          expectedOutputSchema: "workflow-model-v1", acceptanceCriterionIds: ["criterion-decision"],
          requiredCapabilities: [], riskLevel: "low", dependsOn: [],
        }],
        verificationStepIds: ["workflow-step"],
      },
      decisionSummary: "Delegate one bounded discovery step.",
    },
  });
  const { provider, events, executor } = specialist();
  const states = new InMemoryExecutionStateStore();
  const attempts = new InMemoryStepAttemptStore();
  const runtime = new AgentRuntimeService({
    agents, tools: createToolRegistry([]), policies: createPolicyRegistry([dayOnePolicyFixture]),
    executions: new InMemoryExecutionRepository(), states, events,
    createExecutionId: () => snapshot.executionId, now: () => now,
  });
  states.initialize(snapshot.executionId, now);
  runtime.transitionExecution(snapshot.executionId, "planning");
  const loop = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor: executor,
    createStepAttemptId: () => "workflow-attempt-1", now: () => now, nowMs: () => 0, isCancelled: () => false,
  });

  const result = await loop.execute({ goal, validatedPlan });
  assert.equal(result.status, "ready_for_verification");
  assert.deepEqual(provider.workflowRequests[0]?.evidence.map((item) => item.evidenceId), ["evidence-brief"]);
  assert.equal(JSON.stringify(provider.workflowRequests).includes("unrelated-secret"), false);
  assert.deepEqual(
    events.list(snapshot.executionId).filter((event) => event.type.startsWith("model.")).map((event) => event.type),
    ["model.requested", "model.responded"],
  );
  if (result.status === "ready_for_verification") {
    const output = result.outputs["workflow-step"]?.output as ReturnType<typeof workflowModel>;
    assert.equal(output.status, "draft");
    assert.equal(output.facts.length, 1);
    assert.equal(output.assumptions.length, 1);
    assert.equal(output.unknowns.length, 1);
  }
});

test("workflow specialist rejects fabricated or modified evidence", async () => {
  const fabricated = structuredClone(workflowModel());
  fabricated.evidenceReferences[0]!.description = "Provider-authored claim presented as supplied evidence.";
  const context = specialist(fabricated);
  await assert.rejects(
    context.executor.execute({ assignment: assignment(), specialist: workflowAgent }),
    /Invalid payload at specialist.workflow.runtime_validation/,
  );
  assert.equal(context.events.list("execution-1").at(-1)?.payload.accepted, false);
});

test("workflow specialist rejects undeclared capabilities", async () => {
  const fabricated = structuredClone(workflowModel());
  fabricated.stages[0]!.requiredCapabilityKeys = ["unregistered.capability"];
  await assert.rejects(
    specialist(fabricated).executor.execute({ assignment: assignment(), specialist: workflowAgent }),
    /Invalid payload at specialist.workflow.runtime_validation/,
  );
});

test("workflow specialist fails closed when an assignment requests unavailable context", async () => {
  const invalidAssignment = {
    ...assignment(),
    contextRefs: [{ kind: "goal_input" as const, id: "not-supplied" }],
  };
  const context = specialist();
  await assert.rejects(
    context.executor.execute({ assignment: invalidAssignment, specialist: workflowAgent }),
    /Invalid payload at specialist.workflow.context/,
  );
  assert.equal(context.provider.workflowRequests.length, 0);
});
