import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEnvironmentModel, classifyObservations, EnvironmentModelRegistry } from "../lib/agent-runtime/environment-model";
import { resolveProductSnapshot, type ProductVersionManifest } from "../lib/agent-runtime/product-registry";
import { productRegistries } from "./fixtures/product-fixtures";
import { failureObservation, observedAt } from "./fixtures/observation-fixtures";

function context(version: 1 | 2) {
  const expanded = version === 2;
  const manifest: ProductVersionManifest = {
    productVersionId: `operations-suite-product-v${version}`,
    featureVersionIds: expanded ? ["onboarding-feature-v1", "scorecards-feature-v1"] : ["onboarding-feature-v1"],
    capabilityVersionIds: expanded ? ["onboarding-record-read-capability-v1", "scorecard-draft-write-capability-v1"] : ["onboarding-record-read-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"],
    toolVersionIds: expanded ? ["onboarding-record-read-tool-v1", "scorecard-draft-write-tool-v1"] : ["onboarding-record-read-tool-v1"],
    signalDefinitionVersionIds: ["onboarding-completed-signal-v1"], evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"],
  };
  return resolveProductSnapshot({ productSnapshotId: `snapshot-v${version}`, manifest, registries: productRegistries(), createdAt: observedAt });
}

test("environment models are immutable, versioned, and runtime-owned", () => {
  const registry = new EnvironmentModelRegistry();
  const first = registry.register(buildEnvironmentModel({ modelVersionId: "environment-v1", version: 1, productContext: context(1), observations: [], createdAt: observedAt }));
  const second = registry.register(buildEnvironmentModel({ modelVersionId: "environment-v2", version: 2, parentModelVersionId: "environment-v1", productContext: context(2), observations: [], createdAt: observedAt }));
  assert.equal(first.entities.some((item) => item.key === "scorecard.draft.write"), false);
  assert.equal(second.entities.some((item) => item.key === "scorecard.draft.write" && item.epistemicStatus === "known"), true);
  assert.throws(() => (first.entities as unknown[]).push({}), TypeError);
  assert.throws(() => registry.register({ ...second, modelVersionId: "forged", version: 3, createdBy: "provider" }));
});

test("a registered capability change becomes known without core changes", () => {
  const model = buildEnvironmentModel({ modelVersionId: "environment-v2", version: 1, productContext: context(2), observations: [], createdAt: observedAt });
  const observation = failureObservation({
    observationId: "product-change-1", productKey: "operations-suite", productVersionId: "operations-suite-product-v2", productSnapshotId: "snapshot-v2", executionId: undefined,
    subject: { subjectType: "capability", subjectKey: "scorecard.draft.write" },
    signal: { kind: "product_change", signalKey: "product.capability.registered", summary: "Capability appeared in the immutable product snapshot.", changeType: "capability_registered", changedVersionId: "scorecard-draft-write-capability-v1" },
  });
  const detection = classifyObservations({ detectionId: "detection-change", model, observations: [observation] });
  assert.equal(detection.classification, "product_change");
  assert.equal(detection.evidenceStrength, "strong");
  assert.equal(detection.causalClaim, false);
});

test("known weakness, novelty, anomaly, feedback, and noise remain distinct", () => {
  const model = buildEnvironmentModel({ modelVersionId: "environment-v1", version: 1, productContext: context(1), observations: [], createdAt: observedAt });
  const base = { productKey: "operations-suite", productVersionId: "operations-suite-product-v1", productSnapshotId: "snapshot-v1" };
  const failures = [1, 2, 3].map((number) => failureObservation({ ...base, observationId: `failure-${number}`, evidenceIds: [`evidence-${number}`] }));
  assert.equal(classifyObservations({ detectionId: "known", model, observations: failures }).classification, "known_weakness");
  const behavior = failures.slice(0, 2).map((item, index) => ({ ...item, observationId: `behavior-${index}`, signal: { kind: "behavior" as const, signalKey: "usage.new", summary: "New registered-capability behavior.", count: 1 } }));
  assert.equal(classifyObservations({ detectionId: "novel", model, observations: behavior }).classification, "novel_behavior");
  const oneOff = failures.slice(0, 1);
  assert.equal(classifyObservations({ detectionId: "noise", model, observations: oneOff }).classification, "insufficient_evidence");
  const anomalies = failures.slice(0, 2).map((item, index) => ({ ...item, observationId: `anomaly-${index}`, signal: { kind: "anomaly" as const, signalKey: "latency.regression", summary: "Latency increased.", metricKey: "latency_ms", observedValue: 400, baselineValue: 100 } }));
  assert.equal(classifyObservations({ detectionId: "anomaly", model, observations: anomalies }).classification, "regression_anomaly");
  const feedback = failures.slice(0, 1).map((item) => ({ ...item, observationId: "feedback", signal: { kind: "feedback" as const, signalKey: "feedback.handoff", summary: "User reported handoff friction.", themeKey: "handoff.friction", strength: "weak" as const } }));
  assert.equal(classifyObservations({ detectionId: "feedback", model, observations: feedback }).classification, "explicit_feedback");
});

test("unknown or cross-product capabilities cannot be promoted to known", () => {
  const model = buildEnvironmentModel({ modelVersionId: "environment-v1", version: 1, productContext: context(1), observations: [], createdAt: observedAt });
  assert.equal(model.entities.some((item) => item.key === "unregistered.capability"), false);
  assert.throws(() => classifyObservations({ detectionId: "cross", model, observations: [failureObservation()] }), /cross product context/);
});
