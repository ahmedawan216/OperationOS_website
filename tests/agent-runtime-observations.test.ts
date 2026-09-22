import assert from "node:assert/strict";
import { test } from "node:test";

import { observationSchema } from "../lib/agent-runtime/observation-contracts";
import { ObservationStore } from "../lib/agent-runtime/observation-store";
import { executionEvidence, failureObservation, observedAt } from "./fixtures/observation-fixtures";

test("valid observations require registered provenance and are immutable", () => {
  const store = new ObservationStore();
  store.registerEvidence(executionEvidence());
  const observation = store.recordObservation(failureObservation());
  assert.equal(observation.signal.kind, "failure");
  assert.throws(() => (observation.evidenceIds as string[]).push("fabricated"), TypeError);
});

test("malformed, extra, unknown, and self evidence fail closed", () => {
  assert.throws(() => observationSchema.parse({ ...failureObservation(), hiddenReasoning: "secret" }), /unrecognized/i);
  assert.throws(() => observationSchema.parse({ ...failureObservation(), evidenceIds: [] }));
  assert.throws(() => observationSchema.parse({ ...failureObservation(), evidenceIds: ["observation-failure-1"] }), /cannot cite itself/i);
  assert.throws(() => new ObservationStore().recordObservation(failureObservation()), /Unknown observation evidence/);
});

test("cross-product, cross-snapshot, and cross-execution evidence leakage is rejected", () => {
  const store = new ObservationStore();
  store.registerEvidence(executionEvidence());
  assert.throws(() => store.recordObservation(failureObservation({ productKey: "other_product" })), /crosses product/);
  assert.throws(() => store.recordObservation(failureObservation({ productSnapshotId: "snapshot-v3" })), /crosses product/);
  assert.throws(() => store.recordObservation(failureObservation({ executionId: "execution-2" })), /crosses execution/);
});

test("circular and synthetic self-supporting evidence is rejected", () => {
  const store = new ObservationStore();
  assert.throws(() => store.registerEvidence(executionEvidence({ parentEvidenceIds: ["evidence-execution-1"] })), /support itself/);
  store.registerEvidence(executionEvidence());
  store.registerEvidence(executionEvidence({ evidenceId: "hypothesis-evidence", sourceType: "hypothesis", sourceId: "hypothesis-1", parentEvidenceIds: ["evidence-execution-1"] }));
  assert.throws(
    () => store.registerEvidence(executionEvidence({ evidenceId: "derived", sourceId: "derived-source", parentEvidenceIds: ["hypothesis-evidence"] })),
    /Generated proposal cannot become source evidence/,
  );
  assert.throws(
    () => store.recordObservation(failureObservation({ evidenceIds: ["hypothesis-evidence"] })),
    /not primary observation evidence/,
  );
});

test("normalized feedback preserves source and contradictory provenance without mutating product state", () => {
  const store = new ObservationStore();
  store.registerEvidence(executionEvidence({ evidenceId: "feedback-positive", sourceType: "user_feedback", sourceId: "feedback-source-1", executionId: undefined }));
  store.registerEvidence(executionEvidence({ evidenceId: "feedback-counter", sourceType: "user_feedback", sourceId: "feedback-source-2", executionId: undefined }));
  const feedback = store.recordFeedback({
    contractVersion: "normalized-feedback-v1",
    feedbackId: "feedback-1",
    productKey: "operations_suite",
    productVersionId: "operations-suite-product-v2",
    productSnapshotId: "snapshot-v2",
    capabilityKey: "onboarding.record.read",
    observedAt,
    sourceEvidenceId: "feedback-positive",
    themeKey: "handoff.friction",
    summary: "A bounded theme derived from explicit feedback.",
    evidenceStrength: "weak",
    contradictoryEvidenceIds: ["feedback-counter"],
  });
  assert.equal(feedback.sourceEvidenceId, "feedback-positive");
  assert.deepEqual(feedback.contradictoryEvidenceIds, ["feedback-counter"]);
  assert.equal("mutation" in feedback, false);
});
