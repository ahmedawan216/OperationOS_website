import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentDefinitionSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
  userGoalSchema,
} from "../lib/agent-runtime/contracts";
import { InMemoryExecutionRepository } from "../lib/agent-runtime/execution-repository";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "../lib/agent-runtime/registry";
import { AgentRuntimeService, type RuntimeEventDraft } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "../lib/agent-runtime/state";

const now = "2026-09-21T12:00:00.000Z";

test("execution state guards allow the defined path and reject illegal or terminal reopening", () => {
  const store = new InMemoryExecutionStateStore();
  store.initialize("execution-1", now);
  store.transition("execution-1", "planning", now);
  store.transition("execution-1", "running", now);
  store.transition("execution-1", "verifying", now);
  store.transition("execution-1", "succeeded", now);

  assert.equal(store.get("execution-1")?.status, "succeeded");
  assert.throws(() => store.transition("execution-1", "running", now), /Illegal execution transition/);

  const illegal = new InMemoryExecutionStateStore();
  illegal.initialize("execution-2", now);
  assert.throws(() => illegal.transition("execution-2", "succeeded", now), /Illegal execution transition/);
});

test("cancellation is allowed only from nonterminal execution states", () => {
  const store = new InMemoryExecutionStateStore();
  store.initialize("execution-1", now);
  store.transition("execution-1", "cancelled", now);
  assert.throws(() => store.transition("execution-1", "planning", now), /Illegal execution transition/);
});

test("retry creates a new attempt and preserves the failed attempt", () => {
  const store = new InMemoryStepAttemptStore();
  const first = store.createInitial({
    stepAttemptId: "attempt-1",
    executionId: "execution-1",
    stepId: "step-1",
    at: now,
  });
  store.transition(first.stepAttemptId, "running", now);
  store.transition(first.stepAttemptId, "failed", now);
  const retry = store.retry({ failedStepAttemptId: first.stepAttemptId, newStepAttemptId: "attempt-2", at: now });

  assert.equal(retry.attempt, 2);
  assert.equal(retry.retryOfStepAttemptId, "attempt-1");
  assert.equal(store.get("attempt-1")?.status, "failed");
  assert.deepEqual(store.listForStep("execution-1", "step-1").map((item) => item.stepAttemptId), [
    "attempt-1",
    "attempt-2",
  ]);
  assert.throws(
    () => store.retry({ failedStepAttemptId: "attempt-2", newStepAttemptId: "attempt-3", at: now }),
    /Only a failed step attempt/,
  );
});

function runtimeFixture() {
  const modelPolicy = {
    allowedModelKeys: ["model-a"],
    temperatureMin: 0,
    temperatureMax: 1,
    maxOutputTokens: 4_000,
    timeoutMs: 30_000,
  };
  const makeAgent = (agentKey: string, versionId: string, role: "manager" | "specialist") =>
    agentDefinitionSchema.parse({
      agentKey,
      versionId,
      version: 1,
      role,
      status: "active",
      purpose: agentKey,
      instructionTemplate: "Typed work only.",
      inputSchema: "input-v1",
      outputSchema: "output-v1",
      modelPolicy,
      capabilityGrants: [],
      createdBy: "system",
      createdAt: now,
    });
  const agents = createAgentRegistry([
    makeAgent("manager", "manager-v1", "manager"),
    makeAgent("workflow_discovery_specialist", "workflow-v1", "specialist"),
    makeAgent("agent_architecture_specialist", "architecture-v1", "specialist"),
  ]);
  const tools = createToolRegistry([
    toolDefinitionSchema.parse({
      toolKey: "draft.read",
      versionId: "tool-v1",
      description: "Read a draft.",
      inputSchema: "input-v1",
      outputSchema: "output-v1",
      sideEffect: "none",
      riskLevel: "low",
      requiredApproval: "none",
      redactionPaths: [],
      timeoutMs: 10_000,
      idempotent: true,
    }),
  ]);
  const policies = createPolicyRegistry([
    policyBundleVersionSchema.parse({
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
    }),
  ]);
  const states = new InMemoryExecutionStateStore();
  const events: RuntimeEventDraft[] = [];
  let idCounter = 0;
  const dependencies = {
    agents,
    tools,
    policies,
    executions: new InMemoryExecutionRepository(),
    states,
    events: { record: (event: RuntimeEventDraft) => events.push(event) },
    createExecutionId: () => `execution-${++idCounter}`,
    now: () => now,
  };
  const runtime = new AgentRuntimeService(dependencies);
  return { runtime, states, events, dependencies };
}

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

const manifest = {
  managerVersionId: "manager-v1",
  specialistVersionIds: ["workflow-v1", "architecture-v1"] as const,
  policyBundleVersionId: "policy-v1",
  toolVersionIds: ["tool-v1"],
  modelBindings: { manager: "model-a" },
};
const budget = { maxSteps: 10, maxRetriesPerStep: 2, maxWallTimeMs: 60_000 };

test("runtime creates one idempotent execution without any provider call", () => {
  const { runtime, states, events } = runtimeFixture();
  const first = runtime.createGoalExecution({ goal, manifest, budget });
  const duplicate = runtime.createGoalExecution({ goal, manifest, budget });

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.record.executionId, first.record.executionId);
  assert.equal(states.get(first.record.executionId)?.status, "queued");
  assert.equal(events.filter((event) => event.type === "execution.created").length, 1);
});

test("runtime records a valid state event before updating the projection", () => {
  const { runtime, states, events } = runtimeFixture();
  const created = runtime.createGoalExecution({ goal, manifest, budget });
  runtime.transitionExecution(created.record.executionId, "planning");

  assert.equal(states.get(created.record.executionId)?.status, "planning");
  assert.deepEqual(events.at(-1)?.payload, { from: "queued", to: "planning" });
});

test("runtime leaves state unchanged if event persistence fails", () => {
  const fixture = runtimeFixture();
  const created = fixture.runtime.createGoalExecution({ goal, manifest, budget });
  const failingRuntime = new AgentRuntimeService({
    ...fixture.dependencies,
    events: { record: () => { throw new Error("trace unavailable"); } },
  });

  assert.throws(() => failingRuntime.transitionExecution(created.record.executionId, "planning"), /trace unavailable/);
  assert.equal(fixture.states.get(created.record.executionId)?.status, "queued");
});
