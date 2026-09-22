import "server-only";

import {
  agentArchitectureInputSchema,
  agentSystemProposalSchema,
  workflowDiscoveryInputSchema,
  workflowModelSchema,
  type AgentArchitectureInput,
  type AgentSystemProposal,
  type WorkflowDiscoveryInput,
  type WorkflowModel,
} from "./specialist-contracts";
import { managerProviderUsageSchema, type ManagerProviderUsage } from "./manager-contracts";
import { parseContract } from "./validation";

export interface SpecialistProviderResponse { readonly output: unknown; readonly usage?: unknown }

export interface SpecialistProvider {
  discoverWorkflow(input: WorkflowDiscoveryInput): Promise<SpecialistProviderResponse>;
  proposeArchitecture(input: AgentArchitectureInput): Promise<SpecialistProviderResponse>;
}

export async function requestValidatedWorkflowModel(provider: SpecialistProvider, input: WorkflowDiscoveryInput): Promise<{ model: WorkflowModel; usage?: ManagerProviderUsage }> {
  const request = parseContract(workflowDiscoveryInputSchema, input, "specialist.workflow.request");
  const response = await provider.discoverWorkflow(request);
  return {
    model: parseContract(workflowModelSchema, response.output, "specialist.workflow.response"),
    usage: response.usage === undefined ? undefined : parseContract(managerProviderUsageSchema, response.usage, "specialist.workflow.usage"),
  };
}

export async function requestValidatedAgentSystemProposal(provider: SpecialistProvider, input: AgentArchitectureInput): Promise<{ proposal: AgentSystemProposal; usage?: ManagerProviderUsage }> {
  const request = parseContract(agentArchitectureInputSchema, input, "specialist.architecture.request");
  const response = await provider.proposeArchitecture(request);
  return {
    proposal: parseContract(agentSystemProposalSchema, response.output, "specialist.architecture.response"),
    usage: response.usage === undefined ? undefined : parseContract(managerProviderUsageSchema, response.usage, "specialist.architecture.usage"),
  };
}
