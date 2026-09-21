import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentDefinitionSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
  userGoalSchema,
} from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import {
  createAgentRegistry,
  createPolicyRegistry,
  createToolRegistry,
} from "../lib/agent-runtime/registry";
import { resolveExecutionSnapshot } from "../lib/agent-runtime/snapshot";

const now = "2026-09-21T12:00:00.000Z";
const baseModelPolicy = {
  allowedModelKeys: ["model-a"],
  temperatureMin: 0,
  temperatureMax: 1,
  maxOutputTokens: 4_000,
  timeoutMs: 30_000,
};

function agent(agentKey: string, versionId: string, role: "manager" | "specialist") {
  return agentDefinitionSchema.parse({
    agentKey,
    versionId,
    version: 1,
    role,
    status: "active",
    purpose: `${agentKey} purpose`,
    instructionTemplate: "Follow the typed assignment.",
    inputSchema: "agent-assignment-v1",
    outputSchema: "agent-result-v1",
    modelPolicy: baseModelPolicy,
    capabilityGrants: [],
    createdBy: "system",
    createdAt: now,
  });
}

const manager = agent("manager", "manager-v1", "manager");
const workflow = agent("workflow_discovery_specialist", "workflow-v1", "specialist");
const architecture = agent("agent_architecture_specialist", "architecture-v1", "specialist");
const tool = toolDefinitionSchema.parse({
  toolKey: "draft.store",
  versionId: "tool-v1",
  description: "Store an internal draft.",
  inputSchema: "draft-input-v1",
  outputSchema: "draft-output-v1",
  sideEffect: "internal_write",
  riskLevel: "low",
  requiredApproval: "none",
  redactionPaths: ["secret"],
  timeoutMs: 10_000,
  idempotent: true,
});
const policy = policyBundleVersionSchema.parse({
  policyKey: "default",
  versionId: "policy-v1",
  version: 1,
  status: "active",
  description: "Deny by default.",
  defaultDecision: "deny",
  mediumRiskRequiresApproval: true,
  highRiskRequiresExplicitApproval: true,
  createdBy: "system",
  createdAt: now,
});

function dependencies() {
  return {
    agents: createAgentRegistry([manager, workflow, architecture]),
    tools: createToolRegistry([tool]),
    policies: createPolicyRegistry([policy]),
  };
}

function snapshot(executionId = "execution-1") {
  return resolveExecutionSnapshot({
    executionId,
    goalId: "goal-1",
    manifest: {
      managerVersionId: "manager-v1",
      specialistVersionIds: ["workflow-v1", "architecture-v1"],
      policyBundleVersionId: "policy-v1",
      toolVersionIds: ["tool-v1"],
      modelBindings: { workflow: "model-a", manager: "model-a" },
    },
    budget: { maxSteps: 10, maxRetriesPerStep: 2, maxWallTimeMs: 60_000 },
    dependencies: dependencies(),
    createdAt: now,
  });
}

test("registry versions are immutable copies", () => {
  const source = structuredClone(manager);
  const registry = createAgentRegistry([source]);
  source.purpose = "mutated after registration";

  const registered = registry.requireByVersionId("manager-v1");
  assert.equal(registered.purpose, "manager purpose");
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.modelPolicy), true);
  assert.throws(() => Object.assign(registered, { purpose: "attempted mutation" }), TypeError);
});

test("registry rejects duplicate immutable version IDs", () => {
  assert.throws(() => createAgentRegistry([manager, manager]), /Duplicate immutable version/);
});

test("active manifest resolution creates a deterministic exact snapshot", () => {
  const first = snapshot();
  const second = snapshot();

  assert.deepEqual(first, second);
  assert.deepEqual(first.specialistVersionIds, ["workflow-v1", "architecture-v1"]);
  assert.deepEqual(first.toolVersionIds, ["tool-v1"]);
  assert.deepEqual(Object.keys(first.modelBindings), ["manager", "workflow"]);
});

test("a resolved snapshot cannot switch when a later registry version exists", () => {
  const resolved = snapshot();
  const newerManager = { ...manager, versionId: "manager-v2", version: 2, parentVersionId: "manager-v1" };
  const updatedDependencies = {
    agents: createAgentRegistry([manager, newerManager, workflow, architecture]),
    tools: createToolRegistry([tool]),
    policies: createPolicyRegistry([policy]),
  };

  assert.equal(updatedDependencies.agents.requireByVersionId("manager-v2").version, 2);
  assert.equal(resolved.managerVersionId, "manager-v1");
  assert.equal(Object.isFrozen(resolved), true);
});

test("snapshot resolution rejects role and activation mismatches", () => {
  assert.throws(
    () =>
      resolveExecutionSnapshot({
        executionId: "execution-1",
        goalId: "goal-1",
        manifest: {
          managerVersionId: "workflow-v1",
          specialistVersionIds: ["manager-v1", "architecture-v1"],
          policyBundleVersionId: "policy-v1",
          toolVersionIds: ["tool-v1"],
          modelBindings: { manager: "model-a" },
        },
        budget: { maxSteps: 10, maxRetriesPerStep: 2, maxWallTimeMs: 60_000 },
        dependencies: dependencies(),
        createdAt: now,
      }),
    /active manager definition/,
  );
});

test("goal creation is idempotent within a tenant", () => {
  const repository = new InMemoryExecutionRepository();
  const goal = userGoalSchema.parse({
    goalId: "goal-1",
    tenantId: "tenant-1",
    actorId: "actor-1",
    objective: "Map onboarding.",
    inputs: {},
    acceptanceCriteria: [
      { id: "criterion-1", description: "Mapped", evaluator: "deterministic", required: true },
    ],
    constraints: [],
    requestedAt: now,
    idempotencyKey: "tenant-goal-key",
  });
  let factoryCalls = 0;
  const create = () => {
    factoryCalls += 1;
    return {
      executionId: "execution-1",
      tenantId: goal.tenantId,
      idempotencyKey: goal.idempotencyKey,
      goal,
      snapshot: snapshot(),
      status: "queued" as const,
      createdAt: now,
    };
  };

  const first = repository.createOrGet({ goal, create });
  const duplicate = repository.createOrGet({ goal, create });

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.record.executionId, first.record.executionId);
  assert.equal(factoryCalls, 1);
});
