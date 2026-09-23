import "server-only";
import { z } from "zod";
import type { ApprovalLedger } from "../agent-runtime/approvals";
import type { ApprovalSummary, CanarySummary } from "./types";

const text = z.string().trim().min(1).max(500);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

export const founderGovernanceRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve_approval"), productKey: text, approvalId: text, subjectId: text, actionDigest: digest, decision: z.enum(["approved", "rejected"]) }).strict(),
  z.object({ action: z.literal("request_canary_rollback"), productKey: text, canaryId: text, candidateVersionId: text, rollbackVersionId: text, conditionsDigest: digest, reason: text }).strict(),
]);

export const governanceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consume_approved_action"), productKey: text, approvalId: text, subjectId: text, actionDigest: digest, actorId: text, consumedAt: timestamp }).strict(),
  z.object({ action: z.literal("resolve_approval"), productKey: text, approvalId: text, subjectId: text, actionDigest: digest, decision: z.enum(["approved", "rejected"]), actorId: text, resolvedAt: timestamp }).strict(),
  z.object({ action: z.literal("request_canary_rollback"), productKey: text, canaryId: text, candidateVersionId: text, rollbackVersionId: text, conditionsDigest: digest, actorId: text, requestedAt: timestamp, reason: text }).strict(),
]);

export type GovernanceAction = z.infer<typeof governanceActionSchema>;
export interface AuthoritativeApprovalResolver { resolveBoundApproval(input: Extract<GovernanceAction, { action: "resolve_approval" }>): Promise<{ approvalId: string; status: "approved" | "rejected" }> }
export interface AuthoritativeRollbackController { requestBoundRollback(input: Extract<GovernanceAction, { action: "request_canary_rollback" }>): Promise<{ eventId: string; state: "rolled_back" }> }

export async function executeGovernanceAction(input: {
  founderId: string;
  request: unknown;
  approval?: ApprovalSummary;
  canary?: CanarySummary;
  approvals?: ApprovalLedger;
  approvalResolver?: AuthoritativeApprovalResolver;
  rollbackController?: AuthoritativeRollbackController;
}) {
  const request = governanceActionSchema.parse(input.request);
  if (!input.founderId || request.actorId !== input.founderId) throw new Error("Founder action is not authorized");
  if (request.action === "consume_approved_action") {
    const approval = input.approval;
    if (!approval || !input.approvals || approval.status !== "approved") throw new Error("Exact approved action is unavailable");
    if (approval.productKey !== request.productKey || approval.approvalId !== request.approvalId || approval.subjectId !== request.subjectId || approval.actionDigest !== request.actionDigest) throw new Error("Approval payload binding mismatch");
    const consumed = input.approvals.consume({ approvalId: request.approvalId, actionDigest: request.actionDigest, actorId: request.actorId, consumedAt: request.consumedAt });
    return Object.freeze({ action: request.action, status: "consumed" as const, approvalId: consumed.approvalId });
  }
  if (request.action === "resolve_approval") {
    const approval = input.approval;
    if (!approval || !input.approvalResolver || approval.status !== "pending") throw new Error("Pending authoritative approval is unavailable");
    if (approval.productKey !== request.productKey || approval.approvalId !== request.approvalId || approval.subjectId !== request.subjectId || approval.actionDigest !== request.actionDigest) throw new Error("Approval payload binding mismatch");
    return input.approvalResolver.resolveBoundApproval(request);
  }
  const canary = input.canary;
  if (!canary || !input.rollbackController || canary.state !== "canary") throw new Error("Active bounded canary is unavailable");
  if (canary.productKey !== request.productKey || canary.canaryId !== request.canaryId || canary.candidateVersionId !== request.candidateVersionId || canary.rollbackVersionId !== request.rollbackVersionId || canary.conditionsDigest !== request.conditionsDigest) throw new Error("Canary rollback binding mismatch");
  return input.rollbackController.requestBoundRollback(request);
}
