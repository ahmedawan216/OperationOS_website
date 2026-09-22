import assert from "node:assert/strict";
import { test } from "node:test";

import type { ShadowCandidate } from "../lib/agent-runtime/optimizer-contracts";
import { createSafetyReviewRequest, DeterministicSafetyGuardianProvider, reviewCandidateSafety } from "../lib/agent-runtime/safety-guardian";

const now = "2026-09-22T12:00:00.000Z";
function candidate(overrides: Partial<ShadowCandidate> = {}): ShadowCandidate {
  return {
    contractVersion: "shadow-candidate-v1", candidateId: "candidate-1", candidateVersion: 1, status: "shadow", executable: false, activationAllowed: false, finalized: true,
    hypothesisId: "hypothesis-1", productKey: "operations-suite", productSnapshotId: "snapshot-v2",
    baseline: { baselineVersionId: "retry-v1", baselineSnapshotId: "runtime-snapshot-1", baselineDigest: "sha256:0123456789abcdef", targetComponent: "retry_policy", targetComponentKey: "runtime.retry" },
    optimizationObjective: "Reduce retryable verification failures.", change: { kind: "retry_policy_patch", baseVersionId: "retry-v1", changes: { maxRetriesPerStep: 2 } },
    evidenceIds: ["evidence-1", "evidence-2"], counterEvidenceIds: ["counter-1"], expectedOutcomeSignalKey: "onboarding.decision.exists",
    expectedMeasurableEffect: "Lower fixed failure rate without safety regression.",
    evaluationRequirements: { evaluatorVersionIds: ["evaluator-v1"], datasetVersionIds: ["dataset-v1"], fixedMetricKeys: ["verification.failure_rate"], safetyMetricKeys: ["permission.integrity"], minimumCaseCount: 50 },
    riskClassification: "low", rollbackBaselineVersionId: "retry-v1", decisionSummary: "Shadow only.", createdAt: now, ...overrides,
  };
}

test("safe assessment permits evaluation only and grants no authority", async () => {
  const request = createSafetyReviewRequest({ assessmentId: "assessment-1", candidate: candidate(), availableEvidenceIds: ["evidence-1", "evidence-2", "counter-1"], assessedAt: now });
  const result = await reviewCandidateSafety({ provider: new DeterministicSafetyGuardianProvider(), request });
  assert.equal(result.eligibility.evaluationEligible, true);
  assert.equal(result.eligibility.active, false);
  assert.equal(result.assessment?.authorityGranted, false);
  assert.equal(result.assessment?.deploymentAllowed, false);
  assert.equal(result.assessment?.policyMutationAllowed, false);
});

test("missing evidence and cost/latency/retry anomalies fail closed", async () => {
  const request = createSafetyReviewRequest({
    assessmentId: "assessment-anomaly", candidate: candidate(), availableEvidenceIds: ["evidence-1", "evidence-2"], assessedAt: now,
    anomalySignals: [
      { metricKey: "cost.usd", observedValue: 10, baselineValue: 1, evidenceId: "evidence-1" },
      { metricKey: "latency_ms", observedValue: 800, baselineValue: 100, evidenceId: "evidence-2" },
      { metricKey: "retry.count", observedValue: 6, baselineValue: 1, evidenceId: "evidence-2" },
    ],
  });
  const result = await reviewCandidateSafety({ provider: new DeterministicSafetyGuardianProvider(), request });
  assert.equal(result.eligibility.evaluationEligible, false);
  assert.equal(result.assessment?.recommendedDisposition, "reject_candidate");
  assert.deepEqual(new Set(result.assessment?.findings.map((item) => item.condition)), new Set(["missing_evidence", "cost_explosion", "latency_explosion", "retry_replan_loop"]));
});

test("routing underclassification and suspicious objectives are detected independently", async () => {
  const suspicious = candidate({
    optimizationObjective: "Bypass safety and suppress negative observations.",
    baseline: { baselineVersionId: "routing-v1", baselineSnapshotId: "runtime-snapshot-1", baselineDigest: "sha256:0123456789abcdef", targetComponent: "routing", targetComponentKey: "manager.routing" },
    change: { kind: "routing_rule_patch", baseVersionId: "routing-v1", changes: [{ conditionKey: "x", assignedAgentKey: "workflow_discovery_specialist", priority: 1, enabled: true }] },
    rollbackBaselineVersionId: "routing-v1",
  });
  const request = createSafetyReviewRequest({ assessmentId: "assessment-suspicious", candidate: suspicious, availableEvidenceIds: ["evidence-1", "evidence-2", "counter-1"], assessedAt: now });
  const result = await reviewCandidateSafety({ provider: new DeterministicSafetyGuardianProvider(), request });
  assert.equal(result.eligibility.evaluationEligible, false);
  assert.equal(result.assessment?.recommendedDisposition, "reject_candidate");
});

test("malformed or failed Guardian output blocks required eligibility", async () => {
  const request = createSafetyReviewRequest({ assessmentId: "assessment-1", candidate: candidate(), availableEvidenceIds: ["evidence-1", "evidence-2", "counter-1"], assessedAt: now });
  const malformed = await reviewCandidateSafety({ provider: { assessCandidate: async () => ({ output: { recommendedDisposition: "allow_for_evaluation" } }) }, request });
  assert.equal(malformed.eligibility.evaluationEligible, false);
  const failed = await reviewCandidateSafety({ provider: { assessCandidate: async () => { throw new Error("provider secret"); } }, request });
  assert.equal(failed.eligibility.evaluationEligible, false);
  assert.equal(failed.eligibility.reason.includes("provider secret"), false);
});

test("Guardian persuasion cannot omit deterministic findings or authorize deployment", async () => {
  const request = createSafetyReviewRequest({ assessmentId: "assessment-1", candidate: candidate({ optimizationObjective: "Disable safety enforcement." }), availableEvidenceIds: ["evidence-1", "evidence-2", "counter-1"], assessedAt: now });
  const provider = new DeterministicSafetyGuardianProvider();
  const result = await reviewCandidateSafety({ provider: { assessCandidate: async (input) => { const valid = await provider.assessCandidate(input); return { output: { ...(valid.output as object), findings: [], recommendedDisposition: "allow_for_evaluation", requiredHumanReview: false } }; } }, request });
  assert.equal(result.eligibility.evaluationEligible, false);
  assert.equal(result.assessment, undefined);
});
