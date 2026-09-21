import assert from "node:assert/strict";
import { test } from "node:test";

import type { ExecutionSnapshot, UserGoal } from "../lib/agent-runtime/contracts";
import { requestValidatedManagerPlan } from "../lib/agent-runtime/manager-provider";
import { DeterministicFakeManagerProvider } from "../lib/agent-runtime/testing/fake-manager-provider";
import { ContractValidationError } from "../lib/agent-runtime/validation";

const now = "2026-09-21T18:00:00.000Z";
const goal: UserGoal = {
  goalId: "goal-manager-1",
  tenantId: "tenant-1",
  actorId: "actor-1",
  objective: "Discover a workflow and propose its agent architecture.",
  inputs: { brief: "Customer onboarding" },
  acceptanceCriteria: [{
    id: "criterion-1",
    description: "Both specialist outputs are verified.",
    evaluator: "deterministic",
    required: true,
  }],
  constraints: ["No external actions"],
  requestedAt: now,
  idempotencyKey: "manager-goal-attempt-1",
};
const snapshot: ExecutionSnapshot = {
  executionId: "execution-1",
  goalId: goal.goalId,
  managerVersionId: "manager-v1",
  specialistVersionIds: ["workflow-v1", "architecture-v1"],
  policyBundleVersionId: "policy-v1",
  toolVersionIds: [],
  modelBindings: { manager: "fake-manager" },
  maxSteps: 4,
  maxRetriesPerStep: 1,
  maxWallTimeMs: 30_000,
  maxCostUsd: 1,
  createdAt: now,
};

function validProposal() {
  return {
    plan: {
      planId: "plan-1",
      executionId: snapshot.executionId,
      rationaleSummary: "Discover the workflow before proposing the architecture.",
      steps: [
        {
          stepId: "step-workflow",
          sequence: 0,
          objective: "Discover the workflow.",
          assignedAgentKey: "workflow_discovery_specialist",
          inputRefs: [{ kind: "goal_input", id: "brief" }],
          expectedOutputSchema: "workflow-model-v1",
          acceptanceCriterionIds: [],
          requiredCapabilities: [],
          riskLevel: "low",
          dependsOn: [],
        },
      ],
      verificationStepIds: ["step-workflow"],
    },
    decisionSummary: "Workflow evidence must be produced before verification.",
  } as const;
}

test("valid structured Manager plan is accepted at the provider boundary", async () => {
  const provider = new DeterministicFakeManagerProvider([{
    kind: "response",
    response: { output: validProposal(), usage: { costUsd: 0.01, outputTokens: 120 } },
  }]);

  const result = await requestValidatedManagerPlan(provider, {
    goal,
    snapshot,
    planId: "plan-1",
    previousPlanIds: [],
  });

  assert.equal(result.proposal.plan.planId, "plan-1");
  assert.equal(result.usage?.costUsd, 0.01);
  assert.equal(provider.requests.length, 1);
});

test("malformed Manager output is rejected before it can execute", async () => {
  const provider = new DeterministicFakeManagerProvider([{
    kind: "response",
    response: { output: { plan: { planId: "malformed" }, hiddenReasoning: "do not persist" } },
  }]);

  await assert.rejects(
    requestValidatedManagerPlan(provider, { goal, snapshot, planId: "plan-1", previousPlanIds: [] }),
    (error: unknown) => {
      assert.ok(error instanceof ContractValidationError);
      assert.equal(error.runtimeError.code, "VALIDATION_ERROR");
      return true;
    },
  );
});

test("provider usage is independently schema validated", async () => {
  const provider = new DeterministicFakeManagerProvider([{
    kind: "response",
    response: { output: validProposal(), usage: { costUsd: -1 } },
  }]);

  await assert.rejects(
    requestValidatedManagerPlan(provider, { goal, snapshot, planId: "plan-1", previousPlanIds: [] }),
    ContractValidationError,
  );
});
