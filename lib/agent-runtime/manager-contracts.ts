import "server-only";

import { z } from "zod";

import {
  agentResultSchema,
  dataRefSchema,
  executionSnapshotSchema,
  planSchema,
  runtimeErrorSchema,
  userGoalSchema,
} from "./contracts";

const idSchema = z.string().trim().min(1).max(200);
const conciseSummarySchema = z.string().trim().min(1).max(2_000);

export const managerPlanningRequestSchema = z
  .object({
    goal: userGoalSchema,
    snapshot: executionSnapshotSchema,
    planId: idSchema,
    previousPlanIds: z.array(idSchema).max(20),
    recovery: z
      .object({
        failedStepId: idSchema,
        error: runtimeErrorSchema,
        evidenceRefs: z.array(idSchema).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();

export const managerPlanProposalSchema = z
  .object({
    plan: planSchema,
    decisionSummary: conciseSummarySchema,
  })
  .strict();

export const managerProviderUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().finite().nonnegative().optional(),
    durationMs: z.number().int().nonnegative().optional(),
  })
  .strict();

export const criterionVerificationSchema = z
  .object({
    criterionId: idSchema,
    satisfied: z.boolean(),
    evidenceRefs: z.array(dataRefSchema).max(100),
    summary: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((verification, context) => {
    if (verification.satisfied && verification.evidenceRefs.length === 0) {
      context.addIssue({ code: "custom", message: "Satisfied criteria require verifier evidence", path: ["evidenceRefs"] });
    }
  });

export const managerVerificationReportSchema = z
  .object({
    executionId: idSchema,
    planId: idSchema,
    verifierVersionId: idSchema,
    criteria: z.array(criterionVerificationSchema).min(1).max(100),
  })
  .strict();

export const managerFinalResultSchema = z
  .object({
    executionId: idSchema,
    goalId: idSchema,
    planId: idSchema,
    status: z.enum(["succeeded", "failed"]),
    outputs: z.record(idSchema, agentResultSchema),
    verification: managerVerificationReportSchema,
    error: runtimeErrorSchema.optional(),
    costUsd: z.number().finite().nonnegative(),
    completedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "failed" && !result.error) {
      context.addIssue({ code: "custom", message: "Failed final results require an error", path: ["error"] });
    }
    if (result.status === "succeeded" && result.error) {
      context.addIssue({ code: "custom", message: "Successful final results cannot contain an error", path: ["error"] });
    }
  });

export type ManagerPlanningRequest = z.infer<typeof managerPlanningRequestSchema>;
export type ManagerPlanProposal = z.infer<typeof managerPlanProposalSchema>;
export type ManagerProviderUsage = z.infer<typeof managerProviderUsageSchema>;
export type CriterionVerification = z.infer<typeof criterionVerificationSchema>;
export type ManagerVerificationReport = z.infer<typeof managerVerificationReportSchema>;
export type ManagerFinalResult = z.infer<typeof managerFinalResultSchema>;
