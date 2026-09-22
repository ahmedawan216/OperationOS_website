import assert from "node:assert/strict";
import { test } from "node:test";

import type { Hypothesis } from "../lib/agent-runtime/hypothesis-contracts";
import { shadowCandidateSchema, type OptimizerRequest, type ShadowCandidate } from "../lib/agent-runtime/optimizer-contracts";
import { DeterministicShadowOptimizerProvider, requestValidatedShadowCandidate, ShadowCandidateRegistry } from "../lib/agent-runtime/shadow-optimizer";

const now = "2026-09-22T12:00:00.000Z";
const hypothesis: Hypothesis = {
  contractVersion: "hypothesis-v1", hypothesisId: "hypothesis-1", patternId: "pattern-1", status: "proposed", epistemicStatus: "hypothesized",
  productKey: "operations-suite", productVersionId: "operations-suite-product-v2", productSnapshotId: "snapshot-v2",
  subject: { subjectType: "capability", subjectKey: "onboarding.record.read" },
  problemStatement: "Repeated verification failures correlate with an overly broad routing condition.",
  supportEvidenceIds: ["evidence-1", "evidence-2", "evidence-3"], counterEvidenceIds: ["counter-1"],
  affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"],
  expectedOutcomeSignalKey: "onboarding.decision.exists", confidenceBand: "low", uncertainties: ["Causation is not established."],
  proposedExperiment: "Compare on a fixed dataset.", optimizationObjective: "Reduce verified failures.", riskClassification: "low",
  decisionSummary: "Bounded hypothesis only.", createdAt: now,
};

function request(): OptimizerRequest {
  return {
    contractVersion: "shadow-optimizer-request-v1", candidateId: "candidate-1", candidateVersion: 1, hypothesis,
    baseline: { baselineVersionId: "routing-v1", baselineSnapshotId: "runtime-snapshot-1", baselineDigest: "sha256:0123456789abcdef", targetComponent: "routing", targetComponentKey: "manager.routing" },
    optimizationObjective: "Reduce verified failures.", allowedAgentKeys: ["workflow_discovery_specialist", "agent_architecture_specialist"],
    allowedModelKeys: ["deterministic-fake"], allowedToolKeys: ["onboarding.record.read-tool"],
    evaluationRequirements: { evaluatorVersionIds: ["independent-evaluator-v1"], datasetVersionIds: ["regression-suite-v1"], fixedMetricKeys: ["verification.failure_rate"], safetyMetricKeys: ["permission.denial_integrity"], minimumCaseCount: 50 },
    requiredRiskLevel: "low", createdAt: now,
  };
}

const allowedChange: ShadowCandidate["change"] = { kind: "routing_rule_patch", baseVersionId: "routing-v1", changes: [{ conditionKey: "workflow.discovery", assignedAgentKey: "workflow_discovery_specialist", priority: 10, enabled: true }] };

test("a bounded optimizer candidate is immutable, shadow-only, and non-executable", async () => {
  const candidate = await requestValidatedShadowCandidate({ provider: new DeterministicShadowOptimizerProvider(allowedChange), request: request() });
  assert.equal(candidate.status, "shadow");
  assert.equal(candidate.executable, false);
  assert.equal(candidate.activationAllowed, false);
  const stored = new ShadowCandidateRegistry().register(candidate);
  assert.throws(() => (stored.evidenceIds as string[]).push("candidate-1"), TypeError);
});

test("candidate identity, baseline, evidence, counter-evidence, metric, and risk gaming are rejected", async () => {
  const cases: Array<[string, (output: Record<string, unknown>) => void, RegExp]> = [
    ["baseline", (output) => { output.baseline = { ...request().baseline, baselineVersionId: "rewritten" }; }, /Invalid payload|baseline|immutable/i],
    ["evidence", (output) => { output.evidenceIds = ["evidence-1", "candidate-1"]; }, /Invalid payload|cite itself|evidence/i],
    ["counter", (output) => { output.counterEvidenceIds = []; }, /counter-evidence/i],
    ["metric", (output) => { output.evaluationRequirements = { ...request().evaluationRequirements, fixedMetricKeys: ["easy.metric"] }; }, /evaluation requirements/i],
    ["risk", (output) => { output.riskClassification = "medium"; }, /risk classification/i],
    ["activate", (output) => { output.status = "active"; }, /Invalid payload/],
  ];
  for (const [, mutate, expected] of cases) {
    const base = new DeterministicShadowOptimizerProvider(allowedChange);
    await assert.rejects(() => requestValidatedShadowCandidate({ provider: { proposeCandidate: async (input) => { const result = await base.proposeCandidate(input); const output = structuredClone(result.output) as Record<string, unknown>; mutate(output); return { output }; } }, request: request() }), expected);
  }
});

test("forbidden mutation surfaces are structurally rejected", () => {
  const forbiddenKinds = ["source_code_patch", "policy_patch", "permission_patch", "approval_patch", "auth_patch", "safety_patch", "evaluator_patch", "active_deployment_patch", "secret_patch", "schema_patch"];
  for (const kind of forbiddenKinds) {
    assert.throws(() => shadowCandidateSchema.parse({
      contractVersion: "shadow-candidate-v1", candidateId: "candidate-x", candidateVersion: 1, status: "shadow", executable: false, activationAllowed: false, finalized: true,
      hypothesisId: "hypothesis-1", productKey: "operations-suite", productSnapshotId: "snapshot-v2", baseline: request().baseline,
      optimizationObjective: "Reduce failures.", change: { kind, baseVersionId: "routing-v1", patch: "malicious" }, evidenceIds: ["evidence-1", "evidence-2"], counterEvidenceIds: [],
      expectedOutcomeSignalKey: "onboarding.decision.exists", expectedMeasurableEffect: "Claimed effect.", evaluationRequirements: request().evaluationRequirements,
      riskClassification: "low", rollbackBaselineVersionId: "routing-v1", decisionSummary: "Forbidden.", createdAt: now,
    }), /Invalid discriminator|Invalid input/i);
  }
});

test("unregistered agents, models, and tools are rejected instead of created", async () => {
  const changes: ShadowCandidate["change"][] = [
    { kind: "routing_rule_patch", baseVersionId: "routing-v1", changes: [{ conditionKey: "x", assignedAgentKey: "unknown_specialist", priority: 1, enabled: true }] },
    { kind: "model_policy_patch", baseVersionId: "routing-v1", agentKey: "workflow_discovery_specialist", changes: { allowedModelKeys: ["unapproved-model"] } },
    { kind: "approved_tool_selection_patch", baseVersionId: "routing-v1", toolKeys: ["unknown-tool"] },
  ];
  for (const change of changes) await assert.rejects(() => requestValidatedShadowCandidate({ provider: new DeterministicShadowOptimizerProvider(change), request: request() }), /unavailable|unapproved/);
});

test("optimizer provider failures are sanitized", async () => {
  await assert.rejects(() => requestValidatedShadowCandidate({ provider: { proposeCandidate: async () => { throw new Error("provider secret"); } }, request: request() }), (error: Error & { runtimeError?: { code: string } }) => error.message === "Shadow optimizer provider failed" && error.runtimeError?.code === "PROVIDER_ERROR");
});
