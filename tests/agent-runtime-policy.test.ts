import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryApprovalLedger } from "../lib/agent-runtime/approvals";
import {
  agentDefinitionSchema,
  approvalRequestSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
} from "../lib/agent-runtime/contracts";
import { createActionDigest, decideAuthorization, type AuthorizationIntent } from "../lib/agent-runtime/policy";

const now = "2026-09-21T12:00:00.000Z";
const later = "2026-09-21T13:00:00.000Z";
const intent: AuthorizationIntent = {
  actorId: "actor-1",
  tenantId: "tenant-1",
  capabilityKey: "draft.write",
  resourceScope: "tenant:tenant-1/drafts/client-1",
  environment: "preview",
  actionType: "draft.create",
  actionPayload: { title: "Kickoff brief", body: "Draft" },
  requestedRiskLevel: "low",
};
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
      maxRiskLevel: "high",
    },
  ],
  createdBy: "system",
  createdAt: now,
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

function tool(riskLevel: "low" | "medium" | "high" = "low") {
  return toolDefinitionSchema.parse({
    toolKey: "draft.store",
    versionId: `tool-${riskLevel}-v1`,
    description: "Store a draft.",
    inputSchema: "input-v1",
    outputSchema: "output-v1",
    sideEffect: "internal_write",
    riskLevel,
    requiredApproval: riskLevel === "high" ? "explicit_human" : riskLevel === "medium" ? "human" : "none",
    redactionPaths: [],
    timeoutMs: 10_000,
    idempotent: true,
  });
}

function approval(overrides: Record<string, unknown> = {}) {
  const highTool = tool("high");
  return approvalRequestSchema.parse({
    approvalId: "approval-1",
    executionId: "execution-1",
    requestedBy: "manager-v1",
    actorId: intent.actorId,
    actionType: intent.actionType,
    riskLevel: "high",
    approvalType: "explicit_human",
    actionDigest: createActionDigest(intent, highTool),
    summary: "Create the approved draft.",
    expiresAt: later,
    status: "approved",
    resolvedBy: "human-reviewer-1",
    resolvedAt: now,
    ...overrides,
  });
}

test("deny-by-default rejects missing capability, tenant, resource, and environment", () => {
  const missingCapability = decideAuthorization({
    intent: { ...intent, capabilityKey: "unknown" }, agent, tool: tool(), policy, now,
  });
  assert.equal(missingCapability.decision, "deny");
  assert.equal(missingCapability.decision === "deny" && missingCapability.reason, "CAPABILITY_NOT_GRANTED");

  const wrongTenant = decideAuthorization({
    intent: { ...intent, tenantId: "tenant-2" }, agent, tool: tool(), policy, now,
  });
  assert.equal(wrongTenant.decision === "deny" && wrongTenant.reason, "TENANT_SCOPE_MISMATCH");

  const wrongResource = decideAuthorization({
    intent: { ...intent, resourceScope: "tenant:tenant-1/private/client-1" }, agent, tool: tool(), policy, now,
  });
  assert.equal(wrongResource.decision === "deny" && wrongResource.reason, "RESOURCE_SCOPE_NOT_GRANTED");

  const wrongEnvironment = decideAuthorization({
    intent: { ...intent, environment: "production" }, agent, tool: tool(), policy, now,
  });
  assert.equal(wrongEnvironment.decision === "deny" && wrongEnvironment.reason, "ENVIRONMENT_NOT_GRANTED");
});

test("medium and high risk require the correct human approval class", () => {
  const medium = decideAuthorization({ intent, agent, tool: tool("medium"), policy, now });
  assert.equal(medium.decision, "approval_required");
  assert.equal(medium.decision === "approval_required" && medium.approvalType, "human");

  const high = decideAuthorization({ intent, agent, tool: tool("high"), policy, now });
  assert.equal(high.decision, "approval_required");
  assert.equal(high.decision === "approval_required" && high.approvalType, "explicit_human");
});

test("tool risk wins when a model requests a lower risk", () => {
  const decision = decideAuthorization({
    intent: { ...intent, requestedRiskLevel: "low" },
    agent,
    tool: tool("high"),
    policy,
    now,
  });
  assert.equal(decision.effectiveRiskLevel, "high");
  assert.equal(decision.decision, "approval_required");
});

test("expired, consumed, wrong-actor, digest-mismatched, and wrong-type approvals are denied", () => {
  const cases = [
    { expected: "APPROVAL_EXPIRED", value: approval({ expiresAt: now }) },
    { expected: "APPROVAL_INVALID", value: approval({ status: "consumed", consumedAt: now }) },
    { expected: "APPROVAL_ACTOR_MISMATCH", value: approval({ actorId: "actor-2" }) },
    { expected: "APPROVAL_ACTION_MISMATCH", value: approval({ actionDigest: `sha256:${"0".repeat(64)}` }) },
    { expected: "APPROVAL_TYPE_MISMATCH", value: approval({ approvalType: "human" }) },
  ];

  for (const item of cases) {
    const decision = decideAuthorization({ intent, agent, tool: tool("high"), policy, approval: item.value, now });
    assert.equal(decision.decision === "deny" && decision.reason, item.expected);
  }
});

test("an exact approval allows once and the ledger prevents replay", () => {
  const ledger = new InMemoryApprovalLedger();
  const stored = ledger.add(approval());
  const decision = decideAuthorization({ intent, agent, tool: tool("high"), policy, approval: stored, now });

  assert.equal(decision.decision, "allow");
  assert.equal(decision.decision === "allow" && decision.consumeApproval, true);
  if (decision.decision !== "allow" || !decision.approvalId) throw new Error("Expected approved action");

  const consumed = ledger.consume({
    approvalId: decision.approvalId,
    actionDigest: decision.actionDigest,
    actorId: intent.actorId,
    consumedAt: now,
  });
  assert.equal(consumed.status, "consumed");
  assert.throws(
    () =>
      ledger.consume({
        approvalId: decision.approvalId!,
        actionDigest: decision.actionDigest,
        actorId: intent.actorId,
        consumedAt: now,
      }),
    /not available for consumption/,
  );
});
