import "server-only";

import {
  managerPlanProposalSchema,
  managerPlanningRequestSchema,
  managerProviderUsageSchema,
  type ManagerPlanningRequest,
  type ManagerPlanProposal,
  type ManagerProviderUsage,
} from "./manager-contracts";
import { parseContract } from "./validation";

export interface ManagerProviderResponse {
  readonly output: unknown;
  readonly usage?: unknown;
}

export interface ManagerProvider {
  generatePlan(request: ManagerPlanningRequest): Promise<ManagerProviderResponse>;
}

export interface ValidatedManagerResponse {
  readonly proposal: ManagerPlanProposal;
  readonly usage?: ManagerProviderUsage;
}

export async function requestValidatedManagerPlan(
  provider: ManagerProvider,
  request: ManagerPlanningRequest,
): Promise<ValidatedManagerResponse> {
  const validatedRequest = parseContract(managerPlanningRequestSchema, request, "manager.plan.request");
  const response = await provider.generatePlan(validatedRequest);
  const proposal = parseContract(managerPlanProposalSchema, response.output, "manager.plan.response");
  const usage = response.usage === undefined
    ? undefined
    : parseContract(managerProviderUsageSchema, response.usage, "manager.plan.usage");

  return Object.freeze({ proposal, usage });
}
