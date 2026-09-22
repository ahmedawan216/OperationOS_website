import "server-only";
import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const key = z.string().trim().min(1).max(180).regex(/^[a-z][a-z0-9._-]*$/);
const text = z.string().trim().min(1).max(4_000);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const time = z.string().datetime({ offset: true });

export const evaluationCaseSchema = z.object({
  caseId: id, category: key, difficulty: z.enum(["standard", "edge", "adversarial"]),
  inputRef: z.object({ referenceId: id, digest }).strict(),
  expectedConstraints: z.array(text).min(1).max(100), acceptanceCriterionIds: z.array(id).min(1).max(100),
  requiredEvidenceIds: z.array(id).max(100), safetyExpectationKeys: z.array(key).min(1).max(100),
  expectedProperties: z.record(key, z.union([z.string(), z.number(), z.boolean()])),
}).strict();

export const evaluationDatasetSchema = z.object({
  contractVersion: z.literal("evaluation-dataset-v1"), datasetVersionId: id, datasetKey: key,
  version: z.number().int().positive(), parentVersionId: id.optional(), status: z.literal("approved"),
  productKey: key, productSnapshotId: id, cases: z.array(evaluationCaseSchema).min(1).max(10_000),
  digest, createdBy: id, createdAt: time,
}).strict().superRefine((value, ctx) => {
  const ids = value.cases.map((item) => item.caseId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Evaluation case IDs must be unique" });
});

export const evaluatorDefinitionV2Schema = z.object({
  contractVersion: z.literal("evaluator-definition-v1"), evaluatorVersionId: id, evaluatorKey: key,
  version: z.number().int().positive(), parentVersionId: id.optional(), status: z.literal("approved"),
  category: z.enum(["acceptance", "structured_output", "workflow_success", "safety", "latency", "cost", "retry_recovery", "quality"]),
  inputSchemaKey: key, outputMetricKey: key, direction: z.enum(["higher_is_better", "lower_is_better", "must_pass"]),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), nonCompensable: z.boolean(),
  implementationDigest: digest, createdBy: id, createdAt: time,
}).strict();

export const metricThresholdSchema = z.object({
  metricKey: key, evaluatorVersionId: id, direction: z.enum(["higher_is_better", "lower_is_better", "must_pass"]),
  minimumCandidateValue: z.number().finite().optional(), maximumRegression: z.number().nonnegative().finite(),
  nonCompensable: z.boolean(),
}).strict();

export const evaluationPlanSchema = z.object({
  contractVersion: z.literal("evaluation-plan-v1"), planId: id, status: z.literal("frozen"),
  candidateId: id, candidateVersion: z.number().int().positive(), candidateDigest: digest,
  baselineVersionId: id, baselineDigest: digest, datasetVersionId: id, datasetDigest: digest,
  evaluatorVersionIds: z.array(id).min(1).max(100), productKey: key, productSnapshotId: id,
  policyVersionId: id, guardianAssessmentId: id, thresholds: z.array(metricThresholdSchema).min(1).max(100),
  budgets: z.object({ maxCases: z.number().int().positive(), maxRetriesPerCase: z.number().int().min(0).max(3), maxWallTimeMs: z.number().int().positive(), maxCostUsd: z.number().nonnegative().finite() }).strict(),
  conditionsDigest: digest, createdAt: time,
}).strict().superRefine((plan, ctx) => {
  const evaluators = new Set(plan.evaluatorVersionIds);
  for (const threshold of plan.thresholds) if (!evaluators.has(threshold.evaluatorVersionId)) ctx.addIssue({ code: "custom", message: "Threshold evaluator is not frozen in the plan" });
});

export type EvaluationDataset = z.infer<typeof evaluationDatasetSchema>;
export type EvaluatorDefinitionV2 = z.infer<typeof evaluatorDefinitionV2Schema>;
export type EvaluationPlan = z.infer<typeof evaluationPlanSchema>;
