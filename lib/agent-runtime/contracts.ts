import "server-only";

import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9._-]*$/);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const boundedTextSchema = z.string().trim().min(1).max(10_000);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export const environmentSchema = z.enum(["test", "preview", "production"]);
export const executionStatusSchema = z.enum([
  "queued",
  "planning",
  "running",
  "awaiting_approval",
  "verifying",
  "succeeded",
  "failed",
  "cancelled",
]);
export const stepStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "skipped",
  "cancelled",
]);

export const acceptanceCriterionSchema = z
  .object({
    id: idSchema,
    description: z.string().trim().min(1).max(2_000),
    evaluator: z.enum(["deterministic", "model_judge", "human"]),
    required: z.boolean(),
    threshold: z.number().finite().optional(),
  })
  .strict();

export const userGoalSchema = z
  .object({
    goalId: idSchema,
    tenantId: idSchema,
    actorId: idSchema,
    objective: boundedTextSchema,
    inputs: jsonObjectSchema,
    acceptanceCriteria: z.array(acceptanceCriterionSchema).min(1).max(100),
    constraints: z.array(z.string().trim().min(1).max(2_000)).max(100),
    requestedAt: isoDateTimeSchema,
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const executionSnapshotSchema = z
  .object({
    executionId: idSchema,
    goalId: idSchema,
    managerVersionId: idSchema,
    specialistVersionIds: z.array(idSchema).length(2),
    policyBundleVersionId: idSchema,
    toolVersionIds: z.array(idSchema).max(100),
    modelBindings: z.record(keySchema, z.string().trim().min(1).max(200)),
    maxSteps: z.number().int().min(1).max(100),
    maxRetriesPerStep: z.number().int().min(0).max(10),
    maxWallTimeMs: z.number().int().min(1).max(86_400_000),
    maxCostUsd: z.number().nonnegative().finite().optional(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const dataRefSchema = z
  .object({
    kind: z.enum(["goal_input", "step_output", "artifact", "tool_result"]),
    id: idSchema,
    digest: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

export const planStepSchema = z
  .object({
    stepId: idSchema,
    sequence: z.number().int().nonnegative(),
    objective: boundedTextSchema,
    assignedAgentKey: keySchema,
    inputRefs: z.array(dataRefSchema).max(100),
    expectedOutputSchema: z.string().trim().min(1).max(200),
    acceptanceCriterionIds: z.array(idSchema).max(100),
    requiredCapabilities: z.array(keySchema).max(100),
    riskLevel: riskLevelSchema,
    dependsOn: z.array(idSchema).max(100),
  })
  .strict();

export const planSchema = z
  .object({
    planId: idSchema,
    executionId: idSchema,
    rationaleSummary: z.string().trim().min(1).max(4_000),
    steps: z.array(planStepSchema).min(1).max(100),
    verificationStepIds: z.array(idSchema).min(1).max(100),
  })
  .strict();

export const modelPolicySchema = z
  .object({
    allowedModelKeys: z.array(keySchema).min(1).max(20),
    temperatureMin: z.number().min(0).max(2),
    temperatureMax: z.number().min(0).max(2),
    maxOutputTokens: z.number().int().min(1).max(200_000),
    timeoutMs: z.number().int().min(1).max(600_000),
  })
  .strict()
  .refine((policy) => policy.temperatureMin <= policy.temperatureMax, {
    message: "temperatureMin must not exceed temperatureMax",
    path: ["temperatureMin"],
  });

export const capabilityGrantSchema = z
  .object({
    capabilityKey: keySchema,
    resourceScopes: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
    environments: z.array(environmentSchema).min(1).max(3),
    maxRiskLevel: riskLevelSchema,
  })
  .strict();

export const agentDefinitionSchema = z
  .object({
    agentKey: keySchema,
    versionId: idSchema,
    version: z.number().int().positive(),
    role: z.enum(["manager", "specialist"]),
    status: z.enum(["candidate", "active", "retired"]),
    purpose: z.string().trim().min(1).max(2_000),
    instructionTemplate: z.string().trim().min(1).max(100_000),
    inputSchema: z.string().trim().min(1).max(200),
    outputSchema: z.string().trim().min(1).max(200),
    modelPolicy: modelPolicySchema,
    capabilityGrants: z.array(capabilityGrantSchema).max(100),
    createdBy: idSchema,
    createdAt: isoDateTimeSchema,
    parentVersionId: idSchema.optional(),
  })
  .strict();

export const toolDefinitionSchema = z
  .object({
    toolKey: keySchema,
    versionId: idSchema,
    description: z.string().trim().min(1).max(2_000),
    inputSchema: z.string().trim().min(1).max(200),
    outputSchema: z.string().trim().min(1).max(200),
    sideEffect: z.enum(["none", "internal_write", "external_write", "destructive"]),
    riskLevel: riskLevelSchema,
    requiredApproval: z.enum(["none", "human", "explicit_human"]),
    redactionPaths: z.array(z.string().trim().min(1).max(500)).max(100),
    timeoutMs: z.number().int().min(1).max(600_000),
    idempotent: z.boolean(),
  })
  .strict();

export const agentAssignmentSchema = z
  .object({
    executionId: idSchema,
    stepId: idSchema,
    attempt: z.number().int().positive(),
    objective: boundedTextSchema,
    contextRefs: z.array(dataRefSchema).max(100),
    constraints: z.array(z.string().trim().min(1).max(2_000)).max(100),
    expectedOutputSchema: z.string().trim().min(1).max(200),
    deadlineAt: isoDateTimeSchema,
  })
  .strict();

export const runtimeErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "PERMISSION_DENIED",
  "APPROVAL_REQUIRED",
  "BUDGET_EXCEEDED",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "TOOL_ERROR",
  "VERIFICATION_FAILED",
  "CANCELLED",
  "INTERNAL_ERROR",
]);

export const runtimeErrorSchema = z
  .object({
    code: runtimeErrorCodeSchema,
    message: z.string().trim().min(1).max(2_000),
    retryable: z.boolean(),
    safeDetails: jsonObjectSchema.optional(),
  })
  .strict();

export const agentResultSchema = z
  .object({
    executionId: idSchema,
    stepId: idSchema,
    status: z.enum(["completed", "blocked", "failed"]),
    output: z.unknown().optional(),
    evidenceRefs: z.array(dataRefSchema).max(100),
    confidence: z.number().min(0).max(1).optional(),
    unmetCriteria: z.array(idSchema).max(100),
    requestedApprovalId: idSchema.optional(),
    error: runtimeErrorSchema.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "failed" && !result.error) {
      context.addIssue({ code: "custom", message: "Failed results require an error", path: ["error"] });
    }
  });

export const traceEventTypeSchema = z.enum([
  "execution.created",
  "execution.state_changed",
  "plan.created",
  "plan.revised",
  "step.started",
  "step.completed",
  "step.failed",
  "model.requested",
  "model.responded",
  "tool.requested",
  "tool.authorized",
  "tool.denied",
  "tool.completed",
  "approval.requested",
  "approval.resolved",
  "verification.completed",
  "outcome.recorded",
  "candidate.created",
  "candidate.evaluated",
  "deployment.changed",
  "deployment.rolled_back",
]);

export const traceEventSchema = z
  .object({
    eventId: idSchema,
    executionId: idSchema,
    stepId: idSchema.optional(),
    parentEventId: idSchema.optional(),
    sequence: z.number().int().positive(),
    type: traceEventTypeSchema,
    occurredAt: isoDateTimeSchema,
    actor: z
      .object({
        kind: z.enum(["user", "runtime", "agent", "tool", "optimizer"]),
        id: idSchema,
      })
      .strict(),
    versionRefs: z.record(z.string().min(1).max(100), idSchema),
    durationMs: z.number().int().nonnegative().optional(),
    payload: jsonObjectSchema,
    error: runtimeErrorSchema.optional(),
  })
  .strict();

export const outcomeSignalSchema = z
  .object({
    signalId: idSchema,
    executionId: idSchema,
    stepId: idSchema.optional(),
    metricKey: z.enum([
      "goal_success",
      "criterion_score",
      "latency_ms",
      "cost_usd",
      "retry_count",
      "correction_count",
      "routing_success",
      "tool_success",
      "scope_violation",
      "human_override",
    ]),
    value: z.number().finite(),
    unit: z.string().trim().min(1).max(50),
    source: z.enum(["runtime", "deterministic_evaluator", "model_judge", "human"]),
    evaluatorVersionId: idSchema.optional(),
    recordedAt: isoDateTimeSchema,
  })
  .strict();

export const approvalRequestSchema = z
  .object({
    approvalId: idSchema,
    executionId: idSchema.optional(),
    candidateId: idSchema.optional(),
    requestedBy: idSchema,
    actorId: idSchema,
    actionType: keySchema,
    riskLevel: riskLevelSchema,
    actionDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    summary: z.string().trim().min(1).max(4_000),
    expiresAt: isoDateTimeSchema,
    status: z.enum(["pending", "approved", "rejected", "expired", "consumed"]),
    resolvedBy: idSchema.optional(),
    resolvedAt: isoDateTimeSchema.optional(),
    consumedAt: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine((request) => request.executionId || request.candidateId, {
    message: "Approval must reference an execution or candidate",
  });

const structuredTextPatchSchema = z
  .object({
    operations: z
      .array(
        z
          .object({
            operation: z.enum(["replace", "append"]),
            target: z.enum(["instruction_template", "system_guidance"]),
            find: z.string().max(20_000).optional(),
            value: z.string().max(20_000),
          })
          .strict()
          .superRefine((operation, context) => {
            if (operation.operation === "replace" && !operation.find) {
              context.addIssue({ code: "custom", message: "Replace requires find text", path: ["find"] });
            }
          }),
      )
      .min(1)
      .max(20),
  })
  .strict();

const modelPolicyCandidateChangesSchema = z
  .object({
    allowedModelKeys: z.array(keySchema).min(1).max(20).optional(),
    temperatureMin: z.number().min(0).max(2).optional(),
    temperatureMax: z.number().min(0).max(2).optional(),
    maxOutputTokens: z.number().int().min(1).max(200_000).optional(),
    timeoutMs: z.number().int().min(1).max(600_000).optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one model policy change is required");

const routingRuleSchema = z
  .object({
    conditionKey: keySchema,
    assignedAgentKey: keySchema,
    priority: z.number().int().min(0).max(1_000),
    enabled: z.boolean(),
  })
  .strict();

const retryPolicyCandidateChangesSchema = z
  .object({
    maxRetriesPerStep: z.number().int().min(0).max(10).optional(),
    retryDelayMs: z.number().int().min(0).max(300_000).optional(),
    timeoutMs: z.number().int().min(1).max(600_000).optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "At least one retry policy change is required");

export const allowedCandidateChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("prompt_patch"),
      agentKey: keySchema,
      baseVersionId: idSchema,
      patch: structuredTextPatchSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("model_policy_patch"),
      agentKey: keySchema,
      baseVersionId: idSchema,
      changes: modelPolicyCandidateChangesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("routing_rule_patch"),
      baseVersionId: idSchema,
      changes: z.array(routingRuleSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal("retry_policy_patch"),
      baseVersionId: idSchema,
      changes: retryPolicyCandidateChangesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("approved_tool_selection_patch"),
      baseVersionId: idSchema,
      toolKeys: z.array(keySchema).min(1).max(100),
    })
    .strict(),
]);

export const improvementCandidateSchema = z
  .object({
    candidateId: idSchema,
    status: z.enum([
      "draft",
      "shadow",
      "evaluating",
      "passed",
      "failed",
      "awaiting_approval",
      "canary",
      "active",
      "rolled_back",
      "rejected",
    ]),
    basedOnVersionId: idSchema,
    evidenceTraceIds: z.array(idSchema).min(1).max(1_000),
    hypothesis: z.string().trim().min(1).max(4_000),
    change: allowedCandidateChangeSchema,
    predictedBenefits: z.array(z.string().trim().min(1).max(2_000)).max(100),
    knownRisks: z.array(z.string().trim().min(1).max(2_000)).max(100),
    riskLevel: riskLevelSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const evaluationReportSchema = z
  .object({
    evaluationId: idSchema,
    candidateId: idSchema,
    baselineVersionId: idSchema,
    datasetVersionId: idSchema,
    metricDeltas: z.record(keySchema, z.number().finite()),
    safetyRegressions: z.array(z.string().trim().min(1).max(2_000)).max(1_000),
    failedCases: z.array(idSchema).max(10_000),
    verdict: z.enum(["pass", "fail", "inconclusive"]),
    evaluatorVersionIds: z.array(idSchema).min(1).max(100),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
export type StepStatus = z.infer<typeof stepStatusSchema>;
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;
export type UserGoal = z.infer<typeof userGoalSchema>;
export type ExecutionSnapshot = z.infer<typeof executionSnapshotSchema>;
export type DataRef = z.infer<typeof dataRefSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type Plan = z.infer<typeof planSchema>;
export type ModelPolicy = z.infer<typeof modelPolicySchema>;
export type CapabilityGrant = z.infer<typeof capabilityGrantSchema>;
export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type AgentAssignment = z.infer<typeof agentAssignmentSchema>;
export type RuntimeError = z.infer<typeof runtimeErrorSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;
export type TraceEvent = z.infer<typeof traceEventSchema>;
export type OutcomeSignal = z.infer<typeof outcomeSignalSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type AllowedCandidateChange = z.infer<typeof allowedCandidateChangeSchema>;
export type ImprovementCandidate = z.infer<typeof improvementCandidateSchema>;
export type EvaluationReport = z.infer<typeof evaluationReportSchema>;
