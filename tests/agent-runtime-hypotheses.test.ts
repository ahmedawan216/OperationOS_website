import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEnvironmentModel, classifyObservations } from "../lib/agent-runtime/environment-model";
import { aggregateEvidence, DeterministicHypothesisProvider, requestValidatedHypothesis } from "../lib/agent-runtime/hypothesis-service";
import { resolveProductSnapshot } from "../lib/agent-runtime/product-registry";
import { ObservationStore } from "../lib/agent-runtime/observation-store";
import { productRegistries } from "./fixtures/product-fixtures";
import { executionEvidence, failureObservation, observedAt } from "./fixtures/observation-fixtures";

function setup(count = 3) {
  const store = new ObservationStore();
  const observations = Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    store.registerEvidence(executionEvidence({ evidenceId: `evidence-${n}`, sourceId: `trace-${n}`, productKey: "operations-suite" }));
    return store.recordObservation(failureObservation({ observationId: `observation-${n}`, evidenceIds: [`evidence-${n}`], productKey: "operations-suite" }));
  });
  const productContext = resolveProductSnapshot({
    productSnapshotId: "snapshot-v2",
    manifest: { productVersionId: "operations-suite-product-v2", featureVersionIds: ["onboarding-feature-v1", "scorecards-feature-v1"], capabilityVersionIds: ["onboarding-record-read-capability-v1", "scorecard-draft-write-capability-v1"], workflowVersionIds: ["onboarding-workflow-v1"], toolVersionIds: ["onboarding-record-read-tool-v1", "scorecard-draft-write-tool-v1"], signalDefinitionVersionIds: ["onboarding-completed-signal-v1"], evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"] },
    registries: productRegistries(), createdAt: observedAt,
  });
  const model = buildEnvironmentModel({ modelVersionId: "environment-v1", version: 1, productContext, observations, createdAt: observedAt });
  const detection = classifyObservations({ detectionId: "detection-1", model, observations });
  return { store, observations, productContext, detection };
}

test("related observations aggregate without losing support or counter-evidence", () => {
  const { store, detection } = setup();
  store.registerEvidence(executionEvidence({ evidenceId: "counter-1", sourceId: "outcome-counter", sourceType: "execution_outcome", productKey: "operations-suite" }));
  const pattern = aggregateEvidence({ patternId: "pattern-1", detection, counterEvidenceIds: ["counter-1"], store });
  assert.equal(pattern.eligibleForHypothesis, true);
  assert.deepEqual(pattern.supportEvidenceIds, ["evidence-1", "evidence-2", "evidence-3"]);
  assert.deepEqual(pattern.counterEvidenceIds, ["counter-1"]);
});

test("isolated noise remains ineligible and cannot become an optimizer hypothesis", async () => {
  const { store, detection, productContext } = setup(1);
  const pattern = aggregateEvidence({ patternId: "noise", detection, store });
  assert.equal(pattern.eligibleForHypothesis, false);
  await assert.rejects(() => requestValidatedHypothesis({ provider: new DeterministicHypothesisProvider(), request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-noise", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext }), /not eligible/);
});

test("valid provider hypothesis stays proposed and preserves counter-evidence", async () => {
  const { store, detection, productContext } = setup();
  store.registerEvidence(executionEvidence({ evidenceId: "counter-1", sourceId: "outcome-counter", sourceType: "execution_outcome", productKey: "operations-suite" }));
  const pattern = aggregateEvidence({ patternId: "pattern-1", detection, counterEvidenceIds: ["counter-1"], store });
  const hypothesis = await requestValidatedHypothesis({ provider: new DeterministicHypothesisProvider(), request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-1", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext });
  assert.equal(hypothesis.status, "proposed");
  assert.equal(hypothesis.epistemicStatus, "hypothesized");
  assert.deepEqual(hypothesis.counterEvidenceIds, ["counter-1"]);
});

test("hypotheses reject fabricated/self evidence, hidden counter-evidence, and capability expansion", async () => {
  const { store, detection, productContext } = setup();
  store.registerEvidence(executionEvidence({ evidenceId: "counter-1", sourceId: "outcome-counter", sourceType: "execution_outcome", productKey: "operations-suite" }));
  const pattern = aggregateEvidence({ patternId: "pattern-1", detection, counterEvidenceIds: ["counter-1"], store });
  const base = new DeterministicHypothesisProvider();
  await assert.rejects(() => requestValidatedHypothesis({ provider: { proposeHypothesis: async (request) => { const result = await base.proposeHypothesis(request); return { output: { ...(result.output as object), supportEvidenceIds: ["evidence-1", "fabricated"] } }; } }, request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-1", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext }), /Unknown evidence|fabricated/);
  await assert.rejects(() => requestValidatedHypothesis({ provider: { proposeHypothesis: async (request) => { const result = await base.proposeHypothesis(request); return { output: { ...(result.output as object), counterEvidenceIds: [] } }; } }, request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-1", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext }), /preserve all counter-evidence/);
  await assert.rejects(() => requestValidatedHypothesis({ provider: { proposeHypothesis: async (request) => { const result = await base.proposeHypothesis(request); return { output: { ...(result.output as object), affectedCapabilityKeys: ["unregistered.capability"] } }; } }, request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-1", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext }), /expanded affected capabilities/);
});

test("hypothesis provider failures are sanitized", async () => {
  const { store, detection, productContext } = setup();
  const pattern = aggregateEvidence({ patternId: "pattern-1", detection, store });
  await assert.rejects(() => requestValidatedHypothesis({ provider: { proposeHypothesis: async () => { throw new Error("secret provider detail"); } }, request: { contractVersion: "hypothesis-request-v1", hypothesisId: "hypothesis-1", pattern, productVersionId: "operations-suite-product-v2", affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: [], expectedOutcomeSignalKey: "onboarding.decision.exists", createdAt: observedAt }, store, productContext }), (error: Error) => error.message === "Hypothesis provider failed");
});
