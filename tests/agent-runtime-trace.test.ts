import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentDefinitionSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
} from "../lib/agent-runtime/contracts";
import { executeAuthorizedTool } from "../lib/agent-runtime/tool-runtime";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";

const now = "2026-09-21T12:00:00.000Z";

function writerFixture(maxPayloadBytes = 512) {
  const artifacts = new InMemoryTraceArtifactStore();
  let id = 0;
  const writer = new SafeTraceWriter({ maxPayloadBytes, artifacts, createEventId: () => `event-${++id}` });
  return { writer, artifacts };
}

test("trace events are append-only, ordered per execution, and returned immutably", () => {
  const { writer } = writerFixture();
  const draft = (type: "execution.created" | "execution.state_changed") => ({
    type,
    executionId: "execution-1",
    actor: { kind: "runtime" as const, id: "runtime" },
    versionRefs: {},
    payload: { status: type },
    occurredAt: now,
  });
  writer.record(draft("execution.created"));
  writer.record(draft("execution.state_changed"));

  const events = writer.list("execution-1");
  assert.deepEqual(events.map((event) => event.sequence), [1, 2]);
  assert.equal(Object.isFrozen(events[0]), true);
  assert.throws(() => Object.assign(events[0]!, { sequence: 99 }), TypeError);
  assert.deepEqual(writer.list("execution-1").map((event) => event.sequence), [1, 2]);
});

test("trace writer redacts configured paths and always-sensitive keys", () => {
  const { writer } = writerFixture();
  writer.record({
    type: "tool.requested",
    executionId: "execution-1",
    actor: { kind: "runtime", id: "runtime" },
    versionRefs: {},
    payload: {
      credentials: { apiKey: "configured-secret", publicId: "visible" },
      authorization: "Bearer hidden",
      nested: { password: "hidden-too" },
    },
    redactionPaths: ["credentials.apiKey"],
    occurredAt: now,
  });

  assert.deepEqual(writer.list("execution-1")[0]?.payload, {
    credentials: { apiKey: "[REDACTED]", publicId: "visible" },
    authorization: "[REDACTED]",
    nested: { password: "[REDACTED]" },
  });
});

test("oversize trace payloads become bounded artifact references after redaction", () => {
  const { writer, artifacts } = writerFixture(256);
  writer.record({
    type: "tool.completed",
    executionId: "execution-1",
    actor: { kind: "runtime", id: "runtime" },
    versionRefs: {},
    payload: { body: "x".repeat(2_000), secret: "must-not-leak" },
    occurredAt: now,
  });

  const payload = writer.list("execution-1")[0]?.payload as {
    bounded: boolean;
    artifactRef: { id: string };
    originalSizeBytes: number;
  };
  assert.equal(payload.bounded, true);
  assert.ok(payload.originalSizeBytes > 256);
  assert.equal(artifacts.get(payload.artifactRef.id)?.secret, "[REDACTED]");
});

const agent = agentDefinitionSchema.parse({
  agentKey: "workflow_discovery_specialist",
  versionId: "agent-v1",
  version: 1,
  role: "specialist",
  status: "active",
  purpose: "Map workflows.",
  instructionTemplate: "Draft only.",
  inputSchema: "input-v1",
  outputSchema: "output-v1",
  modelPolicy: {
    allowedModelKeys: ["model-a"],
    temperatureMin: 0,
    temperatureMax: 1,
    maxOutputTokens: 4_000,
    timeoutMs: 30_000,
  },
  capabilityGrants: [
    {
      capabilityKey: "draft.write",
      resourceScopes: ["tenant:tenant-1/drafts/*"],
      environments: ["preview"],
      maxRiskLevel: "low",
    },
  ],
  createdBy: "system",
  createdAt: now,
});
const tool = toolDefinitionSchema.parse({
  toolKey: "draft.store",
  versionId: "tool-v1",
  description: "Store a draft.",
  inputSchema: "input-v1",
  outputSchema: "output-v1",
  sideEffect: "internal_write",
  riskLevel: "low",
  requiredApproval: "none",
  redactionPaths: [],
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
const intent = {
  actorId: "actor-1",
  tenantId: "tenant-1",
  capabilityKey: "draft.write",
  resourceScope: "tenant:tenant-1/drafts/client-1",
  environment: "preview" as const,
  actionType: "draft.create",
  actionPayload: { title: "Draft" },
};

test("successful tool execution records requested, authorized, and completed events", async () => {
  const { writer } = writerFixture();
  let calls = 0;
  const result = await executeAuthorizedTool({
    executionId: "execution-1",
    intent,
    agent,
    tool,
    policy,
    events: writer,
    now: () => now,
    execute: async () => { calls += 1; return { id: "draft-1" }; },
  });

  assert.equal(result.status, "completed");
  assert.equal(calls, 1);
  assert.deepEqual(writer.list("execution-1").map((event) => event.type), [
    "tool.requested",
    "tool.authorized",
    "tool.completed",
  ]);
});

test("authorization or required trace persistence failure blocks side effects", async () => {
  let deniedCalls = 0;
  const { writer } = writerFixture();
  const denied = await executeAuthorizedTool({
    executionId: "execution-1",
    intent: { ...intent, capabilityKey: "not-granted" },
    agent,
    tool,
    policy,
    events: writer,
    now: () => now,
    execute: async () => { deniedCalls += 1; },
  });
  assert.equal(denied.status, "blocked");
  assert.equal(deniedCalls, 0);

  let traceFailureCalls = 0;
  await assert.rejects(
    executeAuthorizedTool({
      executionId: "execution-2",
      intent,
      agent,
      tool,
      policy,
      events: { record: () => { throw new Error("trace unavailable"); } },
      now: () => now,
      execute: async () => { traceFailureCalls += 1; },
    }),
    /trace unavailable/,
  );
  assert.equal(traceFailureCalls, 0);
});
