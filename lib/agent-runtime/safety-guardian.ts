import "server-only";

import type { ShadowCandidate } from "./optimizer-contracts";
import {
  candidateEligibilitySchema,
  safetyAssessmentSchema,
  safetyReviewRequestSchema,
  type CandidateEligibility,
  type SafetyAssessment,
  type SafetyFinding,
  type SafetyReviewRequest,
} from "./safety-contracts";
import { parseContract } from "./validation";

export interface SafetyGuardianProvider {
  assessCandidate(request: SafetyReviewRequest): Promise<{ readonly output: unknown }>;
}

function severityRank(value: "low" | "medium" | "high"): number {
  return { low: 0, medium: 1, high: 2 }[value];
}

export function createSafetyReviewRequest(input: {
  assessmentId: string;
  candidate: ShadowCandidate;
  availableEvidenceIds: readonly string[];
  anomalySignals?: readonly SafetyReviewRequest["anomalySignals"][number][];
  assessedAt: string;
}): SafetyReviewRequest {
  const evidence = new Set(input.availableEvidenceIds);
  const findings: SafetyFinding[] = [];
  const add = (condition: SafetyFinding["condition"], severity: SafetyFinding["severity"], evidenceIds: string[], summary: string) => {
    findings.push({ findingId: `${input.assessmentId}:${condition}:${findings.length + 1}`, condition, severity, evidenceIds, summary });
  };
  const missing = [...input.candidate.evidenceIds, ...input.candidate.counterEvidenceIds].filter((id) => !evidence.has(id));
  if (missing.length) add("missing_evidence", "high", missing, "Candidate references evidence unavailable to the safety review.");
  if (/disable|bypass|suppress|ignore|remove safety|rewrite evaluator|grant permission/i.test(input.candidate.optimizationObjective)) {
    add("suspicious_objective", "high", input.candidate.evidenceIds, "Optimization objective contains a forbidden or suspicious authority/safety intent.");
  }
  if ((input.candidate.change.kind === "routing_rule_patch" || input.candidate.change.kind === "approved_tool_selection_patch") && input.candidate.riskClassification === "low") {
    add("risk_underclassified", "medium", input.candidate.evidenceIds, "Routing or tool-selection changes require at least medium-risk review.");
  }
  for (const anomaly of input.anomalySignals ?? []) {
    const ratio = anomaly.baselineValue === 0 ? Number.POSITIVE_INFINITY : anomaly.observedValue / anomaly.baselineValue;
    if (ratio < 2) continue;
    const condition = anomaly.metricKey.includes("cost") ? "cost_explosion" : anomaly.metricKey.includes("latency") ? "latency_explosion" : anomaly.metricKey.includes("retry") || anomaly.metricKey.includes("replan") ? "retry_replan_loop" : "performance_regression";
    add(condition, ratio >= 5 ? "high" : "medium", [anomaly.evidenceId], `${anomaly.metricKey} materially exceeds its immutable baseline.`);
  }
  return safetyReviewRequestSchema.parse({
    contractVersion: "safety-review-request-v1", assessmentId: input.assessmentId, candidate: input.candidate,
    availableEvidenceIds: [...input.availableEvidenceIds], anomalySignals: [...(input.anomalySignals ?? [])],
    deterministicFindings: findings, assessmentRequired: true, assessedAt: input.assessedAt,
  });
}

export async function reviewCandidateSafety(input: {
  provider: SafetyGuardianProvider;
  request: SafetyReviewRequest;
}): Promise<{ assessment?: SafetyAssessment; eligibility: CandidateEligibility }> {
  const request = parseContract(safetyReviewRequestSchema, input.request, "safety-guardian.request");
  let output: unknown;
  try {
    output = (await input.provider.assessCandidate(request)).output;
  } catch {
    return blocked(request, "Safety Guardian provider failed; assessment is required.");
  }
  let assessment: SafetyAssessment;
  try {
    assessment = parseContract(safetyAssessmentSchema, output, "safety-guardian.response");
  } catch {
    return blocked(request, "Safety Guardian assessment was malformed or incomplete.");
  }
  if (assessment.assessmentId !== request.assessmentId || assessment.candidateId !== request.candidate.candidateId) return blocked(request, "Safety Guardian changed runtime-owned identity.");
  const availableEvidence = new Set(request.availableEvidenceIds);
  if (assessment.evidenceIds.length !== availableEvidence.size || assessment.evidenceIds.some((id) => !availableEvidence.has(id))) return blocked(request, "Safety Guardian changed the evidence scope.");
  if (assessment.findings.some((finding) => finding.condition !== "missing_evidence" && finding.evidenceIds.some((id) => !availableEvidence.has(id)))) return blocked(request, "Safety Guardian finding cites unavailable evidence.");
  const requiredIds = new Set(request.deterministicFindings.map((finding) => finding.findingId));
  const returnedIds = new Set(assessment.findings.map((finding) => finding.findingId));
  if ([...requiredIds].some((id) => !returnedIds.has(id))) return blocked(request, "Safety Guardian omitted deterministic safety findings.");
  const hasHigh = assessment.findings.some((finding) => finding.severity === "high");
  const hasMedium = assessment.findings.some((finding) => finding.severity === "medium");
  const expected = hasHigh ? "reject_candidate" : hasMedium ? "require_human_review" : "allow_for_evaluation";
  if (assessment.recommendedDisposition !== expected) return blocked(request, "Safety Guardian disposition conflicts with deterministic runtime findings.");
  const expectedSeverity = hasHigh ? "high" : hasMedium ? "medium" : "low";
  if (assessment.severity !== expectedSeverity) return blocked(request, "Safety Guardian severity conflicts with validated findings.");
  const eligible = expected === "allow_for_evaluation" && !assessment.requiredHumanReview;
  return {
    assessment: deepFreeze(structuredClone(assessment)),
    eligibility: deepFreeze(candidateEligibilitySchema.parse({
      contractVersion: "candidate-eligibility-v1", candidateId: request.candidate.candidateId,
      assessmentId: assessment.assessmentId, evaluationEligible: eligible, active: false, executable: false,
      reason: eligible ? "Validated safety assessment permits independent Day 5 evaluation only." : "Candidate requires review or rejection before evaluation.",
    })),
  };
}

function blocked(request: SafetyReviewRequest, reason: string): { eligibility: CandidateEligibility } {
  return { eligibility: deepFreeze(candidateEligibilitySchema.parse({ contractVersion: "candidate-eligibility-v1", candidateId: request.candidate.candidateId, evaluationEligible: false, active: false, executable: false, reason })) };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export class DeterministicSafetyGuardianProvider implements SafetyGuardianProvider {
  async assessCandidate(request: SafetyReviewRequest): Promise<{ readonly output: unknown }> {
    const severity = request.deterministicFindings.reduce<"low" | "medium" | "high">((current, finding) => severityRank(finding.severity) > severityRank(current) ? finding.severity : current, "low");
    const disposition = severity === "high" ? "reject_candidate" : severity === "medium" ? "require_human_review" : "allow_for_evaluation";
    return { output: {
      contractVersion: "safety-assessment-v1", assessmentId: request.assessmentId, candidateId: request.candidate.candidateId, assessmentVersion: 1,
      severity, riskCategories: request.deterministicFindings.length ? ["evaluation_integrity", "performance"] : ["reliability"],
      evidenceIds: request.availableEvidenceIds, findings: request.deterministicFindings,
      recommendedDisposition: disposition, requiredHumanReview: disposition === "require_human_review",
      authorityGranted: false, deploymentAllowed: false, policyMutationAllowed: false,
      rationaleSummary: request.deterministicFindings.length ? "Deterministic findings constrain the advisory disposition." : "No deterministic safety finding blocks independent evaluation.",
      assessedAt: request.assessedAt,
    } };
  }
}
