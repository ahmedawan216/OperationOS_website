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
import { AgentRuntimeService } from "../lib/agent-runtime/runtime";
import { InMemoryExecutionStateStore } from "../lib/agent-runtime/state";
import { executeAuthorizedTool } from "../lib/agent-runtime/tool-runtime";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";

const now = "2026-09-21T12:00:00.000Z";

test("Day 1 integration runs goal creation, snapshot, state, policy, tool, and trace without a model provider", async () => {
  const modelPolicy = {
    allowedModelKeys: ["fixture-model"],
    temperatureMin: 0,
    temperatureMax: 1,
    maxOutputTokens: 4_000,
    timeoutMs: 30_000,
  };
  const manager = agentDefinitionSchema.parse({
    agentKey: "manager",
    versionId: "manager-v1",
    version: 1,
    role: "manager",
    status: "active",
    purpose: "Manage typed work.",
    instructionTemplate: "No provider call in Day 1.",
    inputSchema: "goal-v1",
    outputSchema: "plan-v1",
    modelPolicy,
    capabilityGrants: [],
    createdBy: "test",
    createdAt: now,
  });
  const workflow = agentDefinitionSchema.parse({
    ...manager,
    agentKey: "workflow_discovery_specialist",
    versionId: "workflow-v1",
    role: "specialist",
    capabilityGrants: [
      {
        capabilityKey: "draft.write",
        resourceScopes: ["tenant:tenant-1/drafts/*"],
        environments: ["test"],
        maxRiskLevel: "low",
      },
    ],
  });
  const architecture = agentDefinitionSchema.parse({
    ...manager,
    agentKey: "agent_architecture_specialist",
    versionId: "architecture-v1",
    role: "specialist",
  });
  const draftTool = toolDefinitionSchema.parse({
    toolKey: "draft.store",
    versionId: "draft-tool-v1",
    description: "Store an internal draft.",
    inputSchema: "draft-v1",
    outputSchema: "draft-ref-v1",
    sideEffect: "internal_write",
    riskLevel: "low",
    requiredApproval: "none",
    redactionPaths: ["draft.secret"],
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
    createdBy: "test",
    createdAt: now,
  });
  const artifacts = new InMemoryTraceArtifactStore();
  let eventCounter = 0;
  const traces = new SafeTraceWriter({
    maxPayloadBytes: 1_024,
    artifacts,
    createEventId: () => `event-${++eventCounter}`,
  });
  const states = new InMemoryExecutionStateStore();
  const runtime = new AgentRuntimeService({
    agents: createAgentRegistry([manager, workflow, architecture]),
    tools: createToolRegistry([draftTool]),
    policies: createPolicyRegistry([policy]),
    executions: new InMemoryExecutionRepository(),
    states,
    events: traces,
    createExecutionId: () => "execution-1",
    now: () => now,
  });
  const goal = userGoalSchema.parse({
    goalId: "goal-1",
    tenantId: "tenant-1",
    actorId: "actor-1",
    objective: "Map the client onboarding workflow.",
    inputs: { notes: "Supplied evidence" },
    acceptanceCriteria: [
      { id: "criterion-1", description: "Workflow is structured", evaluator: "deterministic", required: true },
    ],
    constraints: ["Draft only"],
    requestedAt: now,
    idempotencyKey: "tenant-goal-key",
  });
  const created = runtime.createGoalExecution({
    goal,
    manifest: {
      managerVersionId: manager.versionId,
      specialistVersionIds: [workflow.versionId, architecture.versionId],
      policyBundleVersionId: policy.versionId,
      toolVersionIds: [draftTool.versionId],
      modelBindings: { manager: "fixture-model" },
    },
    budget: { maxSteps: 10, maxRetriesPerStep: 2, maxWallTimeMs: 60_000 },
  });
  runtime.transitionExecution(created.record.executionId, "planning");
  runtime.transitionExecution(created.record.executionId, "running");

  let toolCalls = 0;
  const toolResult = await executeAuthorizedTool({
    executionId: created.record.executionId,
    intent: {
      actorId: goal.actorId,
      tenantId: goal.tenantId,
      capabilityKey: "draft.write",
      resourceScope: "tenant:tenant-1/drafts/workflow-1",
      environment: "test",
      actionType: "draft.create",
      actionPayload: { draft: { title: "Workflow", secret: "redact" } },
    },
    agent: workflow,
    tool: draftTool,
    policy,
    events: traces,
    now: () => now,
    execute: async () => { toolCalls += 1; return { id: "draft-1" }; },
  });

  assert.equal(toolResult.status, "completed");
  assert.equal(toolCalls, 1);
  assert.equal(states.get(created.record.executionId)?.status, "running");
  assert.equal(created.record.snapshot.managerVersionId, "manager-v1");
  assert.deepEqual(created.record.snapshot.specialistVersionIds, ["workflow-v1", "architecture-v1"]);
  assert.deepEqual(traces.list(created.record.executionId).map((event) => event.sequence), [1, 2, 3, 4, 5, 6]);
  assert.equal(traces.list(created.record.executionId).at(-1)?.type, "tool.completed");
});
