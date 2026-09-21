import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allowedCandidateChangeSchema,
  executionSnapshotSchema,
  modelPolicySchema,
  userGoalSchema,
} from "../lib/agent-runtime/contracts";
import { ContractValidationError, parseContract } from "../lib/agent-runtime/validation";

const now = "2026-09-21T12:00:00.000Z";

test("valid goal and two-specialist snapshot contracts parse", () => {
  const goal = parseContract(
    userGoalSchema,
    {
      goalId: "goal-1",
      tenantId: "tenant-1",
      actorId: "actor-1",
      objective: "Map the client onboarding workflow.",
      inputs: { brief: "Current onboarding notes" },
      acceptanceCriteria: [
        {
          id: "criterion-1",
          description: "All workflow stages are present.",
          evaluator: "deterministic",
          required: true,
        },
      ],
      constraints: ["Draft only"],
      requestedAt: now,
      idempotencyKey: "goal-1-attempt-1",
    },
    "goal.request",
  );

  const snapshot = executionSnapshotSchema.parse({
    executionId: "execution-1",
    goalId: goal.goalId,
    managerVersionId: "manager-v1",
    specialistVersionIds: ["workflow-v1", "architecture-v1"],
    policyBundleVersionId: "policy-v1",
    toolVersionIds: ["draft-tool-v1"],
    modelBindings: { manager: "model-a" },
    maxSteps: 10,
    maxRetriesPerStep: 2,
    maxWallTimeMs: 60_000,
    createdAt: now,
  });

  assert.equal(goal.goalId, "goal-1");
  assert.equal(snapshot.specialistVersionIds.length, 2);
});

test("invalid external payloads become typed validation failures", () => {
  assert.throws(
    () => parseContract(userGoalSchema, { goalId: "incomplete" }, "goal.request"),
    (error: unknown) => {
      assert.ok(error instanceof ContractValidationError);
      assert.equal(error.runtimeError.code, "VALIDATION_ERROR");
      assert.equal(error.runtimeError.retryable, false);
      return true;
    },
  );
});

test("model policy rejects inverted temperature bounds", () => {
  assert.equal(
    modelPolicySchema.safeParse({
      allowedModelKeys: ["model-a"],
      temperatureMin: 1.5,
      temperatureMax: 0.2,
      maxOutputTokens: 1_000,
      timeoutMs: 30_000,
    }).success,
    false,
  );
});

test("execution snapshots require exactly two specialists", () => {
  const base = {
    executionId: "execution-1",
    goalId: "goal-1",
    managerVersionId: "manager-v1",
    policyBundleVersionId: "policy-v1",
    toolVersionIds: [],
    modelBindings: { manager: "model-a" },
    maxSteps: 10,
    maxRetriesPerStep: 2,
    maxWallTimeMs: 60_000,
    createdAt: now,
  };

  assert.equal(executionSnapshotSchema.safeParse({ ...base, specialistVersionIds: ["only-one"] }).success, false);
  assert.equal(
    executionSnapshotSchema.safeParse({ ...base, specialistVersionIds: ["one", "two", "three"] }).success,
    false,
  );
});

test("reserved improvement contracts reject arbitrary code and file patches", () => {
  const forbiddenChanges = [
    {
      kind: "source_code_patch",
      baseVersionId: "version-1",
      filePath: "app/api/route.ts",
      code: "export const unsafe = true",
    },
    {
      kind: "prompt_patch",
      agentKey: "workflow_discovery_specialist",
      baseVersionId: "version-1",
      patch: {
        operations: [
          {
            operation: "replace",
            target: "instruction_template",
            find: "old",
            value: "new",
            filePath: "lib/security.ts",
          },
        ],
      },
    },
  ];

  for (const change of forbiddenChanges) {
    assert.equal(allowedCandidateChangeSchema.safeParse(change).success, false);
  }
});

test("reserved prompt improvements accept only constrained text operations", () => {
  const result = allowedCandidateChangeSchema.safeParse({
    kind: "prompt_patch",
    agentKey: "workflow_discovery_specialist",
    baseVersionId: "version-1",
    patch: {
      operations: [
        {
          operation: "replace",
          target: "instruction_template",
          find: "List steps",
          value: "List ordered steps and unresolved questions",
        },
      ],
    },
  });

  assert.equal(result.success, true);
});
