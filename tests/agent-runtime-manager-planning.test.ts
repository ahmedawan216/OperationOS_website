import assert from "node:assert/strict";
import { test } from "node:test";

import { agentDefinitionSchema, type ExecutionSnapshot, type UserGoal } from "../lib/agent-runtime/contracts";
import type { ManagerPlanningRequest, ManagerPlanProposal } from "../lib/agent-runtime/manager-contracts";
import { createSpecialistAssignment, validateManagerPlan } from "../lib/agent-runtime/manager-planning";
import { createAgentRegistry } from "../lib/agent-runtime/registry";

const now = "2026-09-21T18:00:00.000Z";
const modelPolicy = {
  allowedModelKeys: ["fake"], temperatureMin: 0, temperatureMax: 0,
  maxOutputTokens: 1_000, timeoutMs: 10_000,
};
const workflow = agentDefinitionSchema.parse({
  agentKey: "workflow_discovery_specialist", versionId: "workflow-v1", version: 1,
  role: "specialist", status: "active", purpose: "Discover workflows.", instructionTemplate: "Stub.",
  inputSchema: "assignment-v1", outputSchema: "workflow-v1", modelPolicy,
  capabilityGrants: [], createdBy: "test", createdAt: now,
});
const architecture = agentDefinitionSchema.parse({
  agentKey: "agent_architecture_specialist", versionId: "architecture-v1", version: 1,
  role: "specialist", status: "active", purpose: "Design architectures.", instructionTemplate: "Stub.",
  inputSchema: "assignment-v1", outputSchema: "architecture-v1", modelPolicy,
  capabilityGrants: [], createdBy: "test", createdAt: now,
});
const agents = createAgentRegistry([workflow, architecture]);
const goal: UserGoal = {
  goalId: "goal-1", tenantId: "tenant-1", actorId: "actor-1", objective: "Design an agent workflow.",
  inputs: { brief: "Onboarding workflow" },
  acceptanceCriteria: [{ id: "criterion-1", description: "Architecture is present.", evaluator: "deterministic", required: true }],
  constraints: ["No writes"], requestedAt: now, idempotencyKey: "manager-plan-goal-1",
};
const snapshot: ExecutionSnapshot = {
  executionId: "execution-1", goalId: goal.goalId, managerVersionId: "manager-v1",
  specialistVersionIds: [workflow.versionId, architecture.versionId], policyBundleVersionId: "policy-v1",
  toolVersionIds: [], modelBindings: { manager: "fake" }, maxSteps: 4, maxRetriesPerStep: 1,
  maxWallTimeMs: 30_000, createdAt: now,
};
const request: ManagerPlanningRequest = { goal, snapshot, planId: "plan-1", previousPlanIds: [] };

function proposal(): ManagerPlanProposal {
  return {
    plan: {
      planId: "plan-1", executionId: snapshot.executionId, rationaleSummary: "Discover, then design.",
      steps: [
        { stepId: "workflow", sequence: 0, objective: "Discover workflow.", assignedAgentKey: workflow.agentKey,
          inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-v1",
          acceptanceCriterionIds: [], requiredCapabilities: [], riskLevel: "low", dependsOn: [] },
        { stepId: "architecture", sequence: 1, objective: "Design architecture.", assignedAgentKey: architecture.agentKey,
          inputRefs: [{ kind: "step_output", id: "workflow" }], expectedOutputSchema: "architecture-v1",
          acceptanceCriterionIds: ["criterion-1"], requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow"] },
      ],
      verificationStepIds: ["architecture"],
    },
    decisionSummary: "The architecture depends on discovered workflow evidence.",
  };
}

test("valid plan is dependency ordered and routed only to snapshotted specialists", () => {
  const validated = validateManagerPlan({ proposal: proposal(), request, agents });
  assert.deepEqual(validated.orderedSteps.map(({ step }) => step.stepId), ["workflow", "architecture"]);
  assert.deepEqual(validated.orderedSteps.map(({ specialist }) => specialist.versionId), ["workflow-v1", "architecture-v1"]);
});

test("unknown specialist and unauthorized capability are rejected", () => {
  const unknown = proposal();
  unknown.plan.steps[0]!.assignedAgentKey = "unregistered_specialist";
  assert.throws(() => validateManagerPlan({ proposal: unknown, request, agents }), /unknown specialist/);

  const elevated = proposal();
  elevated.plan.steps[0]!.requiredCapabilities = ["external.write"];
  assert.throws(() => validateManagerPlan({ proposal: elevated, request, agents }), /cannot grant unauthorized capability/);
});

test("invalid and cyclic dependencies are rejected", () => {
  const missing = proposal();
  missing.plan.steps[1]!.dependsOn = ["missing"];
  assert.throws(() => validateManagerPlan({ proposal: missing, request, agents }), /Unknown step dependency/);

  const cyclic = proposal();
  cyclic.plan.steps[0]!.dependsOn = ["architecture"];
  assert.throws(() => validateManagerPlan({ proposal: cyclic, request, agents }), /acyclic/);
});

test("assignment context is bounded to declared goal and dependency references", () => {
  const undeclared = proposal();
  undeclared.plan.steps[0]!.inputRefs = [{ kind: "goal_input", id: "secret-not-provided" }];
  assert.throws(() => validateManagerPlan({ proposal: undeclared, request, agents }), /undeclared goal input/);

  const validated = validateManagerPlan({ proposal: proposal(), request, agents });
  const assignment = createSpecialistAssignment({
    executionId: snapshot.executionId,
    validatedStep: validated.orderedSteps[1]!,
    attempt: 1,
    goalConstraints: goal.constraints,
    deadlineAt: "2026-09-21T18:00:30.000Z",
  });
  assert.deepEqual(assignment.contextRefs, [{ kind: "step_output", id: "workflow" }]);
  assert.deepEqual(assignment.constraints, ["No writes"]);
});

test("plan IDs, execution IDs, verification steps, and step budget are runtime authoritative", () => {
  const wrongPlan = proposal();
  wrongPlan.plan.planId = "manager-chosen-id";
  assert.throws(() => validateManagerPlan({ proposal: wrongPlan, request, agents }), /plan ID/);

  const wrongExecution = proposal();
  wrongExecution.plan.executionId = "other-execution";
  assert.throws(() => validateManagerPlan({ proposal: wrongExecution, request, agents }), /execution ID/);

  const unknownVerification = proposal();
  unknownVerification.plan.verificationStepIds = ["missing"];
  assert.throws(() => validateManagerPlan({ proposal: unknownVerification, request, agents }), /Unknown verification step/);

  const unknownCriterion = proposal();
  unknownCriterion.plan.steps[1]!.acceptanceCriterionIds = ["fabricated-criterion"];
  assert.throws(() => validateManagerPlan({ proposal: unknownCriterion, request, agents }), /Unknown acceptance criterion/);

  const uncoveredCriterion = proposal();
  uncoveredCriterion.plan.verificationStepIds = ["workflow"];
  assert.throws(() => validateManagerPlan({ proposal: uncoveredCriterion, request, agents }), /not assigned to a verification step/);

  assert.throws(
    () => validateManagerPlan({ proposal: proposal(), request: { ...request, snapshot: { ...snapshot, maxSteps: 1 } }, agents }),
    /step budget/,
  );
});
