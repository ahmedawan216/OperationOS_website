import "server-only";

import { agentResultSchema, type AgentAssignment, type AgentDefinition, type DataRef } from "./contracts";
import type { SpecialistExecutor, SpecialistExecutionResponse } from "./manager-execution";
import type { ResolvedProductContext } from "./product-registry";
import type { RuntimeEventSink } from "./runtime";
import type { ArchitectureContextResolver } from "./specialist-context";
import type { AgentArchitectureInput, AgentSystemProposal, WorkflowModel } from "./specialist-contracts";
import { requestValidatedAgentSystemProposal, type SpecialistProvider } from "./specialist-provider";
import { ContractValidationError } from "./validation";

export interface AgentArchitectureSpecialistDependencies {
  readonly provider: SpecialistProvider;
  readonly contexts: ArchitectureContextResolver;
  readonly events: RuntimeEventSink;
  readonly now: () => string;
}

function validateRuntimeOwnedProposal(input: {
  assignment: AgentAssignment;
  request: AgentArchitectureInput;
  proposal: AgentSystemProposal;
  workflow: WorkflowModel;
  product: ResolvedProductContext;
}): void {
  const issues: { path: PropertyKey[]; message: string }[] = [];
  if (input.proposal.executionId !== input.assignment.executionId) {
    issues.push({ path: ["executionId"], message: "Proposal execution ID must match its runtime assignment" });
  }
  if (input.proposal.stepId !== input.assignment.stepId) {
    issues.push({ path: ["stepId"], message: "Proposal step ID must match its runtime assignment" });
  }
  if (input.proposal.sourceWorkflowId !== input.workflow.workflowId) {
    issues.push({ path: ["sourceWorkflowId"], message: "Proposal must use the runtime-verified workflow" });
  }
  if (input.proposal.productSnapshotId !== input.product.snapshot.productSnapshotId) {
    issues.push({ path: ["productSnapshotId"], message: "Proposal must use the immutable product snapshot" });
  }

  const capabilities = new Map(input.product.capabilities.map((item) => [item.capabilityKey, item]));
  const tools = new Map(input.product.tools.map((item) => [item.toolKey, item]));
  const evidenceIds = new Set(input.workflow.evidenceReferences.map((item) => item.evidenceId));
  const criterionIds = new Set(input.workflow.successCriteria.map((item) => item.criterionId));
  const allowedContextIds = new Set([
    ...input.product.contexts.map((item) => item.contextRefId),
    input.workflow.stepId,
  ]);
  const evaluators = new Map(input.product.evaluators.map((item) => [item.evaluatorKey, item]));

  for (const agent of input.proposal.agents) {
    for (const requirement of agent.capabilityRequirements) {
      if (!capabilities.has(requirement.capabilityKey)) {
        issues.push({ path: ["agents", agent.proposedAgentId, "capabilityRequirements"], message: `Proposal references an unavailable capability: ${requirement.capabilityKey}` });
      }
      for (const evidenceRef of requirement.evidenceRefs) {
        if (!evidenceIds.has(evidenceRef)) issues.push({ path: ["agents", agent.proposedAgentId, "capabilityRequirements"], message: `Capability requirement references unknown evidence: ${evidenceRef}` });
      }
    }
    for (const requirement of agent.toolRequirements) {
      const tool = tools.get(requirement.toolKey);
      const capability = capabilities.get(requirement.capabilityKey);
      if (!tool) {
        issues.push({ path: ["agents", agent.proposedAgentId, "toolRequirements"], message: `Proposal references an unavailable tool: ${requirement.toolKey}` });
        continue;
      }
      if (!capability || !capability.toolVersionIds.includes(tool.versionId)) {
        issues.push({ path: ["agents", agent.proposedAgentId, "toolRequirements"], message: `Tool is not registered for capability: ${requirement.capabilityKey}` });
      }
      if (requirement.riskLevel !== tool.riskLevel || requirement.approvalType !== tool.requiredApproval) {
        issues.push({ path: ["agents", agent.proposedAgentId, "toolRequirements"], message: `Tool risk or approval does not match its registered definition: ${requirement.toolKey}` });
      }
    }
  }
  for (const boundary of input.proposal.contextBoundaries) {
    for (const referenceId of boundary.allowedReferenceIds) {
      if (!allowedContextIds.has(referenceId)) {
        issues.push({ path: ["contextBoundaries", boundary.boundaryId], message: `Context boundary references unavailable context: ${referenceId}` });
      }
    }
  }
  for (const verification of input.proposal.verificationResponsibilities) {
    if (!criterionIds.has(verification.criterionId)) {
      issues.push({ path: ["verificationResponsibilities", verification.verificationId], message: `Verification references an unknown criterion: ${verification.criterionId}` });
    }
    for (const evidenceRef of verification.requiredEvidenceRefs) {
      if (!evidenceIds.has(evidenceRef)) issues.push({ path: ["verificationResponsibilities", verification.verificationId], message: `Verification references unknown evidence: ${evidenceRef}` });
    }
  }
  for (const outcome of input.proposal.outcomes) {
    const evaluator = evaluators.get(outcome.evaluatorRef);
    if (!evaluator || !evaluator.supportedSignalKeys.includes(outcome.metricKey)) {
      issues.push({ path: ["outcomes", outcome.outcomeId], message: `Outcome references an unavailable evaluator or signal: ${outcome.evaluatorRef}` });
    }
  }
  if (issues.length > 0) throw new ContractValidationError("specialist.architecture.runtime_validation", issues);
}

export class AgentArchitectureSpecialist implements SpecialistExecutor {
  constructor(private readonly dependencies: AgentArchitectureSpecialistDependencies) {}

  async execute(input: { assignment: AgentAssignment; specialist: AgentDefinition }): Promise<SpecialistExecutionResponse> {
    if (input.specialist.agentKey !== "agent_architecture_specialist" || input.specialist.role !== "specialist" || input.specialist.status !== "active") {
      throw new ContractValidationError("specialist.architecture.agent", [{
        path: ["specialist", "agentKey"], message: "Architecture design requires the active registered architecture specialist",
      }]);
    }
    if (input.assignment.expectedOutputSchema !== "agent-system-proposal-v1") {
      throw new ContractValidationError("specialist.architecture.assignment", [{
        path: ["expectedOutputSchema"], message: "Architecture design requires agent-system-proposal-v1",
      }]);
    }
    const context = this.dependencies.contexts.resolveArchitectureContext(input.assignment);
    const request: AgentArchitectureInput = {
      contractVersion: "agent-architecture-input-v1",
      assignment: input.assignment,
      verifiedWorkflowModel: context.verifiedWorkflow.model,
      productSnapshotId: context.productContext.snapshot.productSnapshotId,
      availableCapabilityKeys: context.productContext.capabilities.map((item) => item.capabilityKey),
      availableToolKeys: context.productContext.tools.map((item) => item.toolKey),
      productContextReferenceIds: context.productContext.contexts.map((item) => item.contextRefId),
      constraints: [...input.assignment.constraints],
    };
    this.record("model.requested", input, {
      operation: "agent_architecture", workflowId: context.verifiedWorkflow.model.workflowId,
      productSnapshotId: context.productContext.snapshot.productSnapshotId,
      capabilityCount: request.availableCapabilityKeys.length,
      toolCount: request.availableToolKeys.length,
    }, context.verifiedWorkflow.verifierVersionId, context.productContext.snapshot.productVersionId);
    try {
      const response = await requestValidatedAgentSystemProposal(this.dependencies.provider, request);
      validateRuntimeOwnedProposal({
        assignment: input.assignment, request, proposal: response.proposal,
        workflow: context.verifiedWorkflow.model, product: context.productContext,
      });
      this.record("model.responded", input, {
        operation: "agent_architecture", accepted: true,
        proposalId: response.proposal.proposalId, proposedAgentCount: response.proposal.agents.length,
      }, context.verifiedWorkflow.verifierVersionId, context.productContext.snapshot.productVersionId);
      const evidenceRefs: DataRef[] = [
        context.verifiedWorkflow.sourceRef,
        { kind: "step_output", id: input.assignment.stepId },
      ];
      return {
        result: agentResultSchema.parse({
          executionId: input.assignment.executionId, stepId: input.assignment.stepId,
          status: "completed", output: response.proposal, evidenceRefs,
          confidence: context.verifiedWorkflow.model.unknowns.length === 0 ? 1 : 0.8,
          unmetCriteria: [],
        }),
        usage: response.usage,
      };
    } catch (error) {
      this.record("model.responded", input, { operation: "agent_architecture", accepted: false },
        context.verifiedWorkflow.verifierVersionId, context.productContext.snapshot.productVersionId);
      throw error;
    }
  }

  private record(
    type: "model.requested" | "model.responded",
    input: { assignment: AgentAssignment; specialist: AgentDefinition },
    payload: Record<string, unknown>,
    verifierVersionId: string,
    productVersionId: string,
  ): void {
    this.dependencies.events.record({
      type, executionId: input.assignment.executionId,
      actor: { kind: "runtime", id: "architecture-specialist-runtime" },
      versionRefs: { specialist: input.specialist.versionId, workflowVerifier: verifierVersionId, product: productVersionId },
      payload: { stepId: input.assignment.stepId, attempt: input.assignment.attempt, ...payload },
      occurredAt: this.dependencies.now(),
    });
  }
}
