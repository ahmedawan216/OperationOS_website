import "server-only";

import { z } from "zod";

import { shadowCandidateSchema } from "./optimizer-contracts";
import { riskLevelSchema } from "./contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(2_000);

export const safetyFindingSchema = z.object({
  findingId: idSchema,
  condition: z.enum(["attempted_capability_expansion", "forbidden_change", "tool_selection_expansion", "repeated_failures", "retry_replan_loop", "cost_explosion", "latency_explosion", "performance_regression", "missing_evidence", "suspicious_objective", "evaluation_or_safety_mutation", "unexpected_context_access", "contradictory_evidence", "risk_underclassified"]),
  severity: riskLevelSchema,
  evidenceIds: z.array(idSchema).min(1).max(1_000),
  summary: textSchema,
}).strict();

export const safetyReviewRequestSchema = z.object({
  contractVersion: z.literal("safety-review-request-v1"),
  assessmentId: idSchema,
  candidate: shadowCandidateSchema,
  availableEvidenceIds: z.array(idSchema).min(1).max(10_000),
  anomalySignals: z.array(z.object({
    metricKey: keySchema,
    observedValue: z.number().finite(),
    baselineValue: z.number().finite(),
    evidenceId: idSchema,
  }).strict()).max(1_000),
  deterministicFindings: z.array(safetyFindingSchema).max(1_000),
  assessmentRequired: z.literal(true),
  assessedAt: z.string().datetime({ offset: true }),
}).strict();

export const safetyAssessmentSchema = z.object({
  contractVersion: z.literal("safety-assessment-v1"),
  assessmentId: idSchema,
  candidateId: idSchema,
  assessmentVersion: z.literal(1),
  severity: riskLevelSchema,
  riskCategories: z.array(z.enum(["authority", "security", "policy", "evaluation_integrity", "evidence_integrity", "product_isolation", "performance", "cost", "latency", "reliability"])).min(1).max(100),
  evidenceIds: z.array(idSchema).min(1).max(10_000),
  findings: z.array(safetyFindingSchema).max(1_000),
  recommendedDisposition: z.enum(["allow_for_evaluation", "require_human_review", "reject_candidate", "investigate"]),
  requiredHumanReview: z.boolean(),
  authorityGranted: z.literal(false),
  deploymentAllowed: z.literal(false),
  policyMutationAllowed: z.literal(false),
  rationaleSummary: textSchema,
  assessedAt: z.string().datetime({ offset: true }),
}).strict();

export const candidateEligibilitySchema = z.object({
  contractVersion: z.literal("candidate-eligibility-v1"),
  candidateId: idSchema,
  assessmentId: idSchema.optional(),
  evaluationEligible: z.boolean(),
  active: z.literal(false),
  executable: z.literal(false),
  reason: textSchema,
}).strict();

export type SafetyFinding = z.infer<typeof safetyFindingSchema>;
export type SafetyReviewRequest = z.infer<typeof safetyReviewRequestSchema>;
export type SafetyAssessment = z.infer<typeof safetyAssessmentSchema>;
export type CandidateEligibility = z.infer<typeof candidateEligibilitySchema>;
