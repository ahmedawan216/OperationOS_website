import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";
import { runAuthoritativeEvaluation } from "../lib/agent-runtime/authoritative-evaluation";
import { compareEvaluation } from "../lib/agent-runtime/comparison-engine";
import type { EvaluationRun } from "../lib/agent-runtime/evaluation-engine";
import type { EvaluationPlan } from "../lib/agent-runtime/evaluation-contracts";

const at = "2026-09-24T12:00:00.000Z";
const hash = `sha256:${"a".repeat(64)}`;
const dataset = { contractVersion: "evaluation-dataset-v1", datasetVersionId: "dataset-v1",
  datasetKey: "workflow.quality", version: 1, status: "approved", productKey: "operationos",
  productSnapshotId: "snapshot-v1", digest: hash, createdBy: "operator", createdAt: at,
  cases: [{ caseId: "case-1", category: "workflow", difficulty: "standard",
    inputRef: { referenceId: "input-1", digest: hash }, expectedConstraints: ["No external side effects"],
    acceptanceCriterionIds: ["criterion-1"], requiredEvidenceIds: [],
    safetyExpectationKeys: ["permissions.intact"], expectedProperties: { draft: true } }] };
const evaluator = { contractVersion: "evaluator-definition-v1", evaluatorVersionId: "quality-v1",
  evaluatorKey: "quality", version: 1, status: "approved", category: "quality",
  inputSchemaKey: "workflow", outputMetricKey: "quality", direction: "higher_is_better",
  nonCompensable: false, implementationDigest: hash, createdBy: "operator", createdAt: at };
const plan: EvaluationPlan = { contractVersion: "evaluation-plan-v1", planId: "plan-1", status: "frozen",
  candidateId: "candidate-1", candidateVersion: 1, candidateDigest: hash,
  baselineVersionId: "base-v1", baselineDigest: hash, datasetVersionId: "dataset-v1", datasetDigest: hash,
  evaluatorVersionIds: ["quality-v1"], productKey: "operationos", productSnapshotId: "snapshot-v1",
  policyVersionId: "policy-v1", guardianAssessmentId: "assessment-1",
  thresholds: [{ metricKey: "quality", evaluatorVersionId: "quality-v1", direction: "higher_is_better",
    minimumCandidateValue: 0.5, maximumRegression: 0, nonCompensable: false }],
  budgets: { maxCases: 1, maxRetriesPerCase: 0, maxWallTimeMs: 10_000, maxCostUsd: 1 },
  conditionsDigest: hash, createdAt: at };

test("authoritative evaluation freezes registered inputs before provider and persists every stage", async () => {
  const stages: string[] = [];
  let run: EvaluationRun | undefined;
  const writer = { async requireSource(id: string) {
    stages.push(`source:${id}`);
    if (id === "candidate-1") return { record_kind: "candidate", source_digest: hash,
      payload: { candidateId: "candidate-1" } };
    if (id === "dataset-v1") return { record_kind: "dataset", payload: dataset };
    if (id === "quality-v1") return { record_kind: "evaluator", payload: evaluator };
    throw new Error("Unregistered immutable source");
  }, async append(input: { kind: string; payload: unknown }) {
    stages.push(input.kind);
    if (input.kind === "evaluation_run") run = input.payload as EvaluationRun;
  }, async compareAndPersist() {
    stages.push("comparison");
    return compareEvaluation({ comparisonId: "comparison-1", plan, run: run! });
  }, async decideRisk() {
    stages.push("risk_gate");
    return { decision: "canary_eligible" as const };
  }, async project() { stages.push("projection"); } } as unknown as AuthoritativeLifecycleWriter;
  let providerCalls = 0;
  const executor = { async execute(input: { variant: string }) {
    providerCalls++;
    return { status: "succeeded" as const, metricValues: { quality: input.variant === "baseline" ? 0.6 : 0.9 },
      safetyViolations: [], latencyMs: 5, costUsd: 0, retryCount: 0, verificationFailures: 0,
      evidenceIds: [] };
  } };
  const result = await runAuthoritativeEvaluation({ writer, executionId: "execution-1", candidateId: "candidate-1",
    plan, executor, runId: "run-1", comparisonId: "comparison-1", assessmentId: "assessment-1",
    target: "test", startedAt: at, completedAt: at });
  assert.equal(providerCalls, 2);
  assert.equal(result.comparison.status, "improved");
  assert.deepEqual(stages.slice(-5), ["evaluation_plan", "evaluation_run", "comparison", "risk_gate", "projection"]);
  const blocked = { ...plan, datasetVersionId: "unregistered" };
  await assert.rejects(() => runAuthoritativeEvaluation({ writer, executionId: "execution-1", candidateId: "candidate-1",
    plan: blocked, executor, runId: "run-2", comparisonId: "comparison-2", assessmentId: "assessment-1",
    target: "test", startedAt: at, completedAt: at }), /Unregistered immutable source/);
  assert.equal(providerCalls, 2);
});
