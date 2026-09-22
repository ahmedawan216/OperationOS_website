import "server-only";

import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const timestampSchema = z.string().datetime({ offset: true });
const conciseTextSchema = z.string().trim().min(1).max(2_000);
const digestSchema = z.string().trim().min(16).max(256).regex(/^[a-zA-Z0-9:_-]+$/);

export const observationEvidenceSchema = z.object({
  contractVersion: z.literal("observation-evidence-v1"),
  evidenceId: idSchema,
  sourceType: z.enum([
    "execution_trace", "execution_outcome", "step_outcome", "runtime_error",
    "product_snapshot", "product_change", "outcome_signal", "user_feedback",
    "operator_feedback", "human_correction", "evaluator_result", "product_event",
    "observation", "pattern", "hypothesis", "candidate",
  ]),
  sourceId: idSchema,
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  executionId: idSchema.optional(),
  observedAt: timestampSchema,
  digest: digestSchema,
  sensitivity: z.enum(["public", "internal", "restricted"]),
  parentEvidenceIds: z.array(idSchema).max(100),
}).strict().superRefine((evidence, context) => {
  if (evidence.evidenceId === evidence.sourceId || evidence.parentEvidenceIds.includes(evidence.evidenceId)) {
    context.addIssue({ code: "custom", message: "Evidence cannot reference or support itself" });
  }
  if (new Set(evidence.parentEvidenceIds).size !== evidence.parentEvidenceIds.length) {
    context.addIssue({ code: "custom", message: "Parent evidence references must be unique" });
  }
});

export const observationSubjectSchema = z.object({
  subjectType: z.enum(["product", "feature", "capability", "workflow", "agent", "tool", "execution", "evaluation"]),
  subjectKey: keySchema,
}).strict();

export const observationWindowSchema = z.object({
  startedAt: timestampSchema,
  endedAt: timestampSchema,
}).strict().refine((window) => Date.parse(window.startedAt) <= Date.parse(window.endedAt), {
  message: "Observation window start must not follow its end",
});

const signalBase = {
  signalKey: keySchema,
  summary: conciseTextSchema,
};

export const observationSignalSchema = z.discriminatedUnion("kind", [
  z.object({ ...signalBase, kind: z.literal("behavior"), count: z.number().int().positive() }).strict(),
  z.object({ ...signalBase, kind: z.literal("failure"), errorCode: keySchema, retryable: z.boolean(), count: z.number().int().positive() }).strict(),
  z.object({ ...signalBase, kind: z.literal("product_change"), changeType: z.enum(["product_registered", "feature_registered", "capability_registered", "workflow_registered", "tool_registered", "signal_registered", "evaluator_registered"]), changedVersionId: idSchema }).strict(),
  z.object({ ...signalBase, kind: z.literal("outcome"), value: z.union([z.boolean(), z.number().finite(), z.string().trim().min(1).max(500)]), unit: z.string().trim().min(1).max(100) }).strict(),
  z.object({ ...signalBase, kind: z.literal("correction"), correctionType: z.enum(["user", "operator", "verifier"]), correctedSubjectId: idSchema }).strict(),
  z.object({ ...signalBase, kind: z.literal("feedback"), themeKey: keySchema, strength: z.enum(["weak", "moderate", "strong"]) }).strict(),
  z.object({ ...signalBase, kind: z.literal("anomaly"), metricKey: keySchema, observedValue: z.number().finite(), baselineValue: z.number().finite() }).strict(),
]);

export const observationSchema = z.object({
  contractVersion: z.literal("observation-v1"),
  observationId: idSchema,
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  executionId: idSchema.optional(),
  subject: observationSubjectSchema,
  observedAt: timestampSchema,
  window: observationWindowSchema,
  evidenceIds: z.array(idSchema).min(1).max(500),
  signal: observationSignalSchema,
  decisionSummary: conciseTextSchema,
}).strict().superRefine((observation, context) => {
  if (observation.evidenceIds.includes(observation.observationId)) {
    context.addIssue({ code: "custom", message: "Observation cannot cite itself as evidence" });
  }
  if (new Set(observation.evidenceIds).size !== observation.evidenceIds.length) {
    context.addIssue({ code: "custom", message: "Observation evidence references must be unique" });
  }
});

export const normalizedFeedbackSchema = z.object({
  contractVersion: z.literal("normalized-feedback-v1"),
  feedbackId: idSchema,
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  featureKey: keySchema.optional(),
  workflowKey: keySchema.optional(),
  capabilityKey: keySchema.optional(),
  observedAt: timestampSchema,
  sourceEvidenceId: idSchema,
  themeKey: keySchema,
  summary: conciseTextSchema,
  evidenceStrength: z.enum(["weak", "moderate", "strong"]),
  contradictoryEvidenceIds: z.array(idSchema).max(100),
}).strict();

export const evidenceAggregationSchema = z.object({
  contractVersion: z.literal("evidence-aggregation-v1"),
  aggregationId: idSchema,
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  subject: observationSubjectSchema,
  signalKind: z.enum(["behavior", "failure", "product_change", "outcome", "correction", "feedback", "anomaly"]),
  window: observationWindowSchema,
  observationIds: z.array(idSchema).min(1).max(10_000),
  evidenceIds: z.array(idSchema).min(1).max(10_000),
  supportCount: z.number().int().positive(),
  decisionSummary: conciseTextSchema,
}).strict();

export type ObservationEvidence = z.infer<typeof observationEvidenceSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type NormalizedFeedback = z.infer<typeof normalizedFeedbackSchema>;
export type EvidenceAggregation = z.infer<typeof evidenceAggregationSchema>;
