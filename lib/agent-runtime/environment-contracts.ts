import "server-only";

import { z } from "zod";

import { observationSubjectSchema, observationWindowSchema } from "./observation-contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(2_000);

export const epistemicStatusSchema = z.enum(["known", "hypothesized", "unknown"]);

export const environmentEntitySchema = z.object({
  entityId: idSchema,
  entityType: z.enum(["product", "feature", "capability", "workflow", "agent", "tool", "user_intent", "outcome_signal", "evaluator", "feedback_theme", "failure_pattern", "behavior_pattern", "hypothesis"]),
  key: keySchema,
  registeredVersionId: idSchema.optional(),
  epistemicStatus: epistemicStatusSchema,
  evidenceIds: z.array(idSchema).min(1).max(1_000),
  summary: textSchema,
}).strict();

export const environmentRelationshipSchema = z.object({
  relationshipId: idSchema,
  fromEntityId: idSchema,
  toEntityId: idSchema,
  relationshipType: z.enum(["contains", "requires", "uses", "produces", "evaluated_by", "observed_with", "affects", "supports", "contradicts"]),
  epistemicStatus: epistemicStatusSchema,
  evidenceIds: z.array(idSchema).min(1).max(1_000),
}).strict();

export const productEnvironmentModelSchema = z.object({
  contractVersion: z.literal("product-environment-model-v1"),
  modelVersionId: idSchema,
  version: z.number().int().positive(),
  parentModelVersionId: idSchema.optional(),
  productKey: keySchema,
  productVersionId: idSchema,
  productSnapshotId: idSchema,
  entities: z.array(environmentEntitySchema).min(1).max(10_000),
  relationships: z.array(environmentRelationshipSchema).max(20_000),
  sourceObservationIds: z.array(idSchema).max(10_000),
  createdAt: z.string().datetime({ offset: true }),
  createdBy: z.literal("runtime"),
}).strict().superRefine((model, context) => {
  const entityIds = model.entities.map((entity) => entity.entityId);
  if (new Set(entityIds).size !== entityIds.length) context.addIssue({ code: "custom", message: "Environment entity IDs must be unique" });
  const relationshipIds = model.relationships.map((relationship) => relationship.relationshipId);
  if (new Set(relationshipIds).size !== relationshipIds.length) context.addIssue({ code: "custom", message: "Environment relationship IDs must be unique" });
  const entities = new Set(entityIds);
  for (const relation of model.relationships) {
    if (!entities.has(relation.fromEntityId) || !entities.has(relation.toEntityId) || relation.fromEntityId === relation.toEntityId) {
      context.addIssue({ code: "custom", message: `Environment relationship has invalid endpoints: ${relation.relationshipId}` });
    }
  }
});

export const detectionClassificationSchema = z.object({
  contractVersion: z.literal("detection-classification-v1"),
  detectionId: idSchema,
  classification: z.enum(["known_weakness", "novel_behavior", "explicit_feedback", "product_change", "regression_anomaly", "insufficient_evidence"]),
  productKey: keySchema,
  productSnapshotId: idSchema,
  subject: observationSubjectSchema,
  window: observationWindowSchema,
  observationIds: z.array(idSchema).min(1).max(10_000),
  evidenceIds: z.array(idSchema).min(1).max(10_000),
  evidenceStrength: z.enum(["insufficient", "weak", "moderate", "strong"]),
  causalClaim: z.literal(false),
  decisionSummary: textSchema,
}).strict();

export type ProductEnvironmentModel = z.infer<typeof productEnvironmentModelSchema>;
export type DetectionClassification = z.infer<typeof detectionClassificationSchema>;
