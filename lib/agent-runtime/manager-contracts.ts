import "server-only";

import { z } from "zod";

import {
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

export type ManagerPlanningRequest = z.infer<typeof managerPlanningRequestSchema>;
export type ManagerPlanProposal = z.infer<typeof managerPlanProposalSchema>;
export type ManagerProviderUsage = z.infer<typeof managerProviderUsageSchema>;
