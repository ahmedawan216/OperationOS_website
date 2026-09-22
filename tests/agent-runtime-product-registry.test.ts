import assert from "node:assert/strict";
import { test } from "node:test";

import { agentDefinitionSchema, policyBundleVersionSchema } from "../lib/agent-runtime/contracts";
import { decideAuthorization } from "../lib/agent-runtime/policy";
import { productDefinitionSchema } from "../lib/agent-runtime/product-contracts";
import { resolveProductSnapshot, type ProductVersionManifest } from "../lib/agent-runtime/product-registry";
import {
  productDefinitionFixtures,
  productRegistries,
  productToolFixtures,
} from "./fixtures/product-fixtures";

const now = "2026-09-22T00:00:00.000Z";

function manifest(productVersionId = "operations-suite-product-v1"): ProductVersionManifest {
  const expanded = productVersionId.endsWith("v2");
  return {
    productVersionId,
    featureVersionIds: expanded ? ["scorecards-feature-v1", "onboarding-feature-v1"] : ["onboarding-feature-v1"],
    capabilityVersionIds: expanded
      ? ["scorecard-draft-write-capability-v1", "onboarding-record-read-capability-v1"]
      : ["onboarding-record-read-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"],
    toolVersionIds: expanded
      ? ["scorecard-draft-write-tool-v1", "onboarding-record-read-tool-v1"]
      : ["onboarding-record-read-tool-v1"],
    signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
    evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"],
    contextReferenceVersionIds: ["onboarding-context-version-v1"],
  };
}

test("product registration is immutable, versioned, and snapshots are deterministic", () => {
  const registries = productRegistries();
  const first = resolveProductSnapshot({
    productSnapshotId: "snapshot-v2", manifest: manifest("operations-suite-product-v2"), registries, createdAt: now,
  });
  const reversed = manifest("operations-suite-product-v2");
  const second = resolveProductSnapshot({
    productSnapshotId: "snapshot-v2",
    manifest: {
      ...reversed,
      featureVersionIds: [...reversed.featureVersionIds].reverse(),
      capabilityVersionIds: [...reversed.capabilityVersionIds].reverse(),
      toolVersionIds: [...reversed.toolVersionIds].reverse(),
    },
    registries,
    createdAt: now,
  });

  assert.deepEqual(first.snapshot, second.snapshot);
  assert.deepEqual(first.capabilities.map((item) => item.capabilityKey), [
    "onboarding.record.read", "scorecard.draft.write",
  ]);
  assert.throws(() => {
    (first.product.featureVersionIds as string[]).push("mutation");
  }, TypeError);
  assert.equal(registries.products.requireByVersionId("operations-suite-product-v1").version, 1);
  assert.equal(registries.products.requireByVersionId("operations-suite-product-v2").version, 2);
});

test("newly registered capabilities become discoverable through data, not specialist core changes", () => {
  const registries = productRegistries();
  const before = resolveProductSnapshot({
    productSnapshotId: "snapshot-v1", manifest: manifest(), registries, createdAt: now,
  });
  const after = resolveProductSnapshot({
    productSnapshotId: "snapshot-v2", manifest: manifest("operations-suite-product-v2"), registries, createdAt: now,
  });

  assert.equal(before.capabilities.some((item) => item.capabilityKey === "scorecard.draft.write"), false);
  assert.equal(after.capabilities.some((item) => item.capabilityKey === "scorecard.draft.write"), true);
  assert.throws(
    () => resolveProductSnapshot({
      productSnapshotId: "invalid", manifest: {
        ...manifest(), capabilityVersionIds: ["unregistered-capability-v1"],
      }, registries, createdAt: now,
    }),
    /not registered by the product version|Unknown immutable version/,
  );
});

test("snapshot resolution rejects cross-product or omitted capability tools", () => {
  const registries = productRegistries();
  assert.throws(
    () => resolveProductSnapshot({
      productSnapshotId: "missing-tool", manifest: { ...manifest(), toolVersionIds: [] }, registries, createdAt: now,
    }),
    /Capability tool is missing/,
  );
  assert.throws(
    () => resolveProductSnapshot({
      productSnapshotId: "unlisted-capability", manifest: {
        ...manifest(), capabilityVersionIds: ["scorecard-draft-write-capability-v1"],
        toolVersionIds: ["scorecard-draft-write-tool-v1"],
      }, registries, createdAt: now,
    }),
    /not registered by the product version/,
  );
  assert.throws(
    () => resolveProductSnapshot({
      productSnapshotId: "duplicate", manifest: {
        ...manifest(), capabilityVersionIds: ["onboarding-record-read-capability-v1", "onboarding-record-read-capability-v1"],
      }, registries, createdAt: now,
    }),
    /must be unique/,
  );
  assert.throws(
    () => resolveProductSnapshot({
      productSnapshotId: "dangling-feature", manifest: {
        ...manifest(), capabilityVersionIds: [], toolVersionIds: [],
      }, registries, createdAt: now,
    }),
    /Feature onboarding capability is missing/,
  );
});

test("product registration never grants runtime permission", () => {
  const registries = productRegistries();
  const context = resolveProductSnapshot({
    productSnapshotId: "snapshot-v2", manifest: manifest("operations-suite-product-v2"), registries, createdAt: now,
  });
  assert.equal(context.capabilities.some((item) => item.capabilityKey === "scorecard.draft.write"), true);

  const agent = agentDefinitionSchema.parse({
    agentKey: "agent_architecture_specialist", versionId: "architecture-specialist-v1", version: 1,
    role: "specialist", status: "active", purpose: "Propose only.", instructionTemplate: "No writes.",
    inputSchema: "agent-architecture-input-v1", outputSchema: "agent-system-proposal-v1",
    modelPolicy: { allowedModelKeys: ["deterministic-fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 4_000, timeoutMs: 30_000 },
    capabilityGrants: [], createdBy: "operationos", createdAt: now,
  });
  const policy = policyBundleVersionSchema.parse({
    policyKey: "default", versionId: "policy-v1", version: 1, status: "active", description: "Deny by default.",
    defaultDecision: "deny", mediumRiskRequiresApproval: true, highRiskRequiresExplicitApproval: true,
    createdBy: "operationos", createdAt: now,
  });
  const decision = decideAuthorization({
    intent: {
      actorId: "actor-1", tenantId: "tenant-1", capabilityKey: "scorecard.draft.write",
      resourceScope: "tenant:tenant-1/scorecards/draft-1", environment: "preview",
      actionType: "scorecard.draft.write", actionPayload: {},
    },
    agent,
    tool: productToolFixtures[1]!,
    policy,
    now,
  });
  assert.equal(decision.decision, "deny");
  assert.equal(decision.decision === "deny" && decision.reason, "CAPABILITY_NOT_GRANTED");
});

test("product contracts reject extra fields", () => {
  const source = productDefinitionFixtures[0]!;
  assert.throws(
    () => productDefinitionSchema.parse({ ...source, arbitrarySchemaMutation: true }),
    /unrecognized|Unrecognized/i,
  );
  assert.throws(
    () => productRegistries().products.requireByVersionId("missing"),
    /Unknown immutable version/,
  );
});
