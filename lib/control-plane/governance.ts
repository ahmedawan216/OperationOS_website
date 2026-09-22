import "server-only";
import { z } from "zod";
import type { ApprovalLedger } from "../agent-runtime/approvals";
import type { ApprovalSummary, CanarySummary } from "./types";
const text=z.string().trim().min(1).max(500);
export const governanceActionSchema=z.discriminatedUnion("action",[
z.object({action:z.literal("consume_approved_action"),approvalId:text,subjectId:text,actionDigest:text,actorId:text,consumedAt:z.string().datetime({offset:true})}).strict(),
z.object({action:z.literal("request_canary_rollback"),canaryId:text,candidateVersionId:text,rollbackVersionId:text,conditionsDigest:text,actorId:text,requestedAt:z.string().datetime({offset:true}),reason:text}).strict(),
]);
export type GovernanceAction=z.infer<typeof governanceActionSchema>;
export interface AuthoritativeRollbackController{requestBoundRollback(input:Extract<GovernanceAction,{action:"request_canary_rollback"}>):Promise<{eventId:string;state:"rolled_back"}>}
export async function executeGovernanceAction(input:{founderId:string;request:unknown;approval?:ApprovalSummary;canary?:CanarySummary;approvals?:ApprovalLedger;rollbackController?:AuthoritativeRollbackController}){const request=governanceActionSchema.parse(input.request);if(!input.founderId||request.actorId!==input.founderId)throw new Error("Founder action is not authorized");if(request.action==="consume_approved_action"){const approval=input.approval;if(!approval||!input.approvals||approval.status!=="approved")throw new Error("Exact approved action is unavailable");if(approval.approvalId!==request.approvalId||approval.subjectId!==request.subjectId||approval.actionDigest!==request.actionDigest)throw new Error("Approval payload binding mismatch");const consumed=input.approvals.consume({approvalId:request.approvalId,actionDigest:request.actionDigest,actorId:request.actorId,consumedAt:request.consumedAt});return Object.freeze({action:request.action,status:"consumed"as const,approvalId:consumed.approvalId})}const canary=input.canary;if(!canary||!input.rollbackController||canary.state!=="canary")throw new Error("Active bounded canary is unavailable");if(canary.canaryId!==request.canaryId||canary.candidateVersionId!==request.candidateVersionId||canary.rollbackVersionId!==request.rollbackVersionId)throw new Error("Canary rollback binding mismatch");return input.rollbackController.requestBoundRollback(request)}
