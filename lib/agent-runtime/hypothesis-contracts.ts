import "server-only";

import { z } from "zod";

import { detectionClassificationSchema, epistemicStatusSchema } from "./environment-contracts";
import { observationSubjectSchema, observationWindowSchema } from "./observation-contracts";
import { riskLevelSchema } from "./contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(4_000);

export const evidencePatternSchema = z.object({
  contractVersion: z.literal("evidence-pattern-v1"),
  patternId: idSchema,
  productKey: keySchema,
  productSnapshotId: idSchema,
  subject: observationSubjectSchema,
  classification: detectionClassificationSchema.shape.classification,
  epistemicStatus: epistemicStatusSchema,
  window: observationWindowSchema,
  observationIds: z.array(idSchema).min(1).max(10_000),
  supportEvidenceIds: z.array(idSchema).min(1).max(10_000),
  counterEvidenceIds: z.array(idSchema).max(10_000),
  supportCount: z.number().int().positive(),
  eligibleForHypothesis: z.boolean(),
  decisionSummary: textSchema,
}).strict().superRefine((pattern, context) => {
  const overlap = pattern.supportEvidenceIds.filter((id) => pattern.counterEvidenceIds.includes(id));
  if (overlap.length) context.addIssue({ code: "custom", message: "Evidence cannot simultaneously support and contradict a pattern" });
  if (pattern.classification === "insufficient_evidence" && pattern.eligibleForHypothesis) context.addIssue({ code: "custom", message: "Insufficient evidence cannot be hypothesis-eligible" });
});

export const hypothesisSchema = z.object({
  contractVersion: z.literal("hypothesis-v1"),
  hypothesisId: idSchema,
  patternId: idSchema,
  status: z.literal("proposed"),
  epistemicStatus: z.literal("hypothesized"),
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  subject: observationSubjectSchema,
  problemStatement: textSchema,
  supportEvidenceIds: z.array(idSchema).min(2).max(10_000),
  counterEvidenceIds: z.array(idSchema).max(10_000),
  affectedCapabilityKeys: z.array(keySchema).max(500),
  affectedWorkflowKeys: z.array(keySchema).max(500),
  expectedOutcomeSignalKey: keySchema,
  confidenceBand: z.enum(["low", "medium", "high"]),
  uncertainties: z.array(textSchema).min(1).max(100),
  proposedExperiment: textSchema,
  optimizationObjective: textSchema,
  riskClassification: riskLevelSchema,
  decisionSummary: textSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict().superRefine((hypothesis, context) => {
  if (hypothesis.supportEvidenceIds.includes(hypothesis.hypothesisId) || hypothesis.counterEvidenceIds.includes(hypothesis.hypothesisId)) {
    context.addIssue({ code: "custom", message: "Hypothesis cannot cite itself" });
  }
  const overlap = hypothesis.supportEvidenceIds.filter((id) => hypothesis.counterEvidenceIds.includes(id));
  if (overlap.length) context.addIssue({ code: "custom", message: "Hypothesis support and counter-evidence must be distinct" });
});

export const hypothesisRequestSchema = z.object({
  contractVersion: z.literal("hypothesis-request-v1"),
  hypothesisId: idSchema,
  pattern: evidencePatternSchema,
  productVersionId: idSchema,
  affectedCapabilityKeys: z.array(keySchema).max(500),
  affectedWorkflowKeys: z.array(keySchema).max(500),
  expectedOutcomeSignalKey: keySchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export type EvidencePattern = z.infer<typeof evidencePatternSchema>;
export type Hypothesis = z.infer<typeof hypothesisSchema>;
export type HypothesisRequest = z.infer<typeof hypothesisRequestSchema>;
