import "server-only";

import { z } from "zod";

import { riskLevelSchema } from "./contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(4_000);
const versionFields = {
  versionId: idSchema,
  version: z.number().int().positive(),
  status: z.enum(["candidate", "active", "retired"]),
  createdBy: idSchema,
  createdAt: z.string().datetime({ offset: true }),
};

export const productFeatureSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  featureKey: keySchema,
  name: z.string().trim().min(1).max(200),
  description: textSchema,
  capabilityVersionIds: z.array(idSchema).max(500),
  workflowVersionIds: z.array(idSchema).max(100),
  contextReferenceVersionIds: z.array(idSchema).max(500),
}).strict();

export const productCapabilitySchema = z.object({
  ...versionFields,
  productKey: keySchema,
  featureKey: keySchema.optional(),
  capabilityKey: keySchema,
  description: textSchema,
  actionClass: z.enum(["read", "draft", "internal_write", "external_write", "destructive"]),
  riskLevel: riskLevelSchema,
  resourceScopes: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
  toolVersionIds: z.array(idSchema).max(100),
}).strict().superRefine((capability, context) => {
  if ((capability.actionClass === "external_write" || capability.actionClass === "destructive") && capability.riskLevel !== "high") {
    context.addIssue({ code: "custom", message: "External and destructive capabilities must be high risk", path: ["riskLevel"] });
  }
  if (capability.actionClass === "internal_write" && capability.riskLevel === "low") {
    context.addIssue({ code: "custom", message: "Internal-write capabilities cannot be low risk", path: ["riskLevel"] });
  }
});

export const productWorkflowMetadataSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  featureKey: keySchema.optional(),
  workflowKey: keySchema,
  description: textSchema,
  stageKeys: z.array(keySchema).min(1).max(200),
  capabilityKeys: z.array(keySchema).max(500),
  outcomeSignalKeys: z.array(keySchema).max(200),
}).strict();

export const outcomeSignalDefinitionSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  featureKey: keySchema.optional(),
  signalKey: keySchema,
  description: textSchema,
  valueType: z.enum(["boolean", "number", "duration_ms", "count", "ratio"]),
  unit: z.string().trim().min(1).max(100),
}).strict();

export const productEvaluatorDefinitionSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  evaluatorKey: keySchema,
  description: textSchema,
  inputSchema: keySchema,
  outputSchema: keySchema,
  supportedSignalKeys: z.array(keySchema).min(1).max(200),
}).strict();

export const productContextReferenceSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  featureKey: keySchema.optional(),
  contextRefId: idSchema,
  kind: z.enum(["schema", "resource", "policy", "guidance", "workflow_metadata"]),
  description: textSchema,
  referenceUri: z.string().trim().min(1).max(1_000),
  digest: z.string().trim().min(1).max(256),
  sensitivity: z.enum(["public", "internal", "restricted"]),
}).strict();

export const productDefinitionSchema = z.object({
  ...versionFields,
  productKey: keySchema,
  name: z.string().trim().min(1).max(200),
  description: textSchema,
  featureVersionIds: z.array(idSchema).max(500),
  capabilityVersionIds: z.array(idSchema).max(1_000),
  workflowVersionIds: z.array(idSchema).max(500),
  signalDefinitionVersionIds: z.array(idSchema).max(500),
  evaluatorDefinitionVersionIds: z.array(idSchema).max(500),
  contextReferenceVersionIds: z.array(idSchema).max(1_000),
}).strict();

export const productSnapshotSchema = z.object({
  productSnapshotId: idSchema,
  productVersionId: idSchema,
  featureVersionIds: z.array(idSchema).max(500),
  capabilityVersionIds: z.array(idSchema).max(1_000),
  workflowVersionIds: z.array(idSchema).max(500),
  toolVersionIds: z.array(idSchema).max(500),
  signalDefinitionVersionIds: z.array(idSchema).max(500),
  evaluatorDefinitionVersionIds: z.array(idSchema).max(500),
  contextReferenceVersionIds: z.array(idSchema).max(1_000),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export type ProductFeature = z.infer<typeof productFeatureSchema>;
export type ProductCapability = z.infer<typeof productCapabilitySchema>;
export type ProductWorkflowMetadata = z.infer<typeof productWorkflowMetadataSchema>;
export type OutcomeSignalDefinition = z.infer<typeof outcomeSignalDefinitionSchema>;
export type ProductEvaluatorDefinition = z.infer<typeof productEvaluatorDefinitionSchema>;
export type ProductContextReference = z.infer<typeof productContextReferenceSchema>;
export type ProductDefinition = z.infer<typeof productDefinitionSchema>;
export type ProductSnapshot = z.infer<typeof productSnapshotSchema>;
