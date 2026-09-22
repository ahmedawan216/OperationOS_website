import "server-only";

import { z } from "zod";

import { allowedCandidateChangeSchema, riskLevelSchema } from "./contracts";
import { hypothesisSchema } from "./hypothesis-contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(4_000);
const digestSchema = z.string().trim().min(16).max(256).regex(/^[a-zA-Z0-9:_-]+$/);

export const immutableBaselineReferenceSchema = z.object({
  baselineVersionId: idSchema,
  baselineSnapshotId: idSchema,
  baselineDigest: digestSchema,
  targetComponent: z.enum(["manager", "specialist", "routing", "retry_policy", "tool_selection"]),
  targetComponentKey: keySchema,
}).strict();

export const candidateEvaluationRequirementsSchema = z.object({
  evaluatorVersionIds: z.array(idSchema).min(1).max(100),
  datasetVersionIds: z.array(idSchema).min(1).max(100),
  fixedMetricKeys: z.array(keySchema).min(1).max(100),
  safetyMetricKeys: z.array(keySchema).min(1).max(100),
  minimumCaseCount: z.number().int().positive().max(1_000_000),
}).strict();

export const optimizerRequestSchema = z.object({
  contractVersion: z.literal("shadow-optimizer-request-v1"),
  candidateId: idSchema,
  candidateVersion: z.number().int().positive(),
  parentCandidateId: idSchema.optional(),
  hypothesis: hypothesisSchema,
  baseline: immutableBaselineReferenceSchema,
  optimizationObjective: textSchema,
  allowedAgentKeys: z.array(keySchema).max(100),
  allowedModelKeys: z.array(keySchema).max(100),
  allowedToolKeys: z.array(keySchema).max(100),
  evaluationRequirements: candidateEvaluationRequirementsSchema,
  requiredRiskLevel: riskLevelSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export const shadowCandidateSchema = z.object({
  contractVersion: z.literal("shadow-candidate-v1"),
  candidateId: idSchema,
  candidateVersion: z.number().int().positive(),
  parentCandidateId: idSchema.optional(),
  status: z.literal("shadow"),
  executable: z.literal(false),
  activationAllowed: z.literal(false),
  finalized: z.literal(true),
  hypothesisId: idSchema,
  productKey: keySchema,
  productSnapshotId: idSchema,
  baseline: immutableBaselineReferenceSchema,
  optimizationObjective: textSchema,
  change: allowedCandidateChangeSchema,
  evidenceIds: z.array(idSchema).min(2).max(10_000),
  counterEvidenceIds: z.array(idSchema).max(10_000),
  expectedOutcomeSignalKey: keySchema,
  expectedMeasurableEffect: textSchema,
  evaluationRequirements: candidateEvaluationRequirementsSchema,
  riskClassification: riskLevelSchema,
  rollbackBaselineVersionId: idSchema,
  decisionSummary: textSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict().superRefine((candidate, context) => {
  if (candidate.evidenceIds.includes(candidate.candidateId) || candidate.counterEvidenceIds.includes(candidate.candidateId)) {
    context.addIssue({ code: "custom", message: "Candidate cannot cite itself as evidence" });
  }
  if (candidate.change.baseVersionId !== candidate.baseline.baselineVersionId) {
    context.addIssue({ code: "custom", message: "Candidate change must reference the immutable baseline version" });
  }
  if (candidate.rollbackBaselineVersionId !== candidate.baseline.baselineVersionId) {
    context.addIssue({ code: "custom", message: "Rollback reference must be the immutable baseline version" });
  }
});

export type OptimizerRequest = z.infer<typeof optimizerRequestSchema>;
export type ShadowCandidate = z.infer<typeof shadowCandidateSchema>;
