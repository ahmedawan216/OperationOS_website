import "server-only";

import { agentResultSchema, type AgentAssignment, type AgentDefinition, type DataRef } from "./contracts";
import type { SpecialistExecutor, SpecialistExecutionResponse } from "./manager-execution";
import type { RuntimeEventSink } from "./runtime";
import type { WorkflowContextResolver } from "./specialist-context";
import type { WorkflowDiscoveryInput, WorkflowEvidenceReference, WorkflowModel } from "./specialist-contracts";
import { requestValidatedWorkflowModel, type SpecialistProvider } from "./specialist-provider";
import { ContractValidationError } from "./validation";

export interface WorkflowDiscoverySpecialistDependencies {
  readonly provider: SpecialistProvider;
  readonly contexts: WorkflowContextResolver;
  readonly events: RuntimeEventSink;
  readonly now: () => string;
}

function sameReference(left: WorkflowEvidenceReference, right: WorkflowEvidenceReference): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateRuntimeOwnedOutput(input: {
  assignment: AgentAssignment;
  request: WorkflowDiscoveryInput;
  model: WorkflowModel;
}): void {
  const issues: { path: PropertyKey[]; message: string }[] = [];
  if (input.model.executionId !== input.assignment.executionId) {
    issues.push({ path: ["executionId"], message: "Workflow execution ID must match its runtime assignment" });
  }
  if (input.model.stepId !== input.assignment.stepId) {
    issues.push({ path: ["stepId"], message: "Workflow step ID must match its runtime assignment" });
  }
  const suppliedEvidence = new Map(input.request.evidence.map((item) => [item.evidenceId, item]));
  for (const evidence of input.model.evidenceReferences) {
    const supplied = suppliedEvidence.get(evidence.evidenceId);
    if (!supplied || !sameReference(evidence, supplied)) {
      issues.push({ path: ["evidenceReferences", evidence.evidenceId], message: "Workflow evidence must exactly match supplied evidence" });
    }
  }
  const capabilities = new Set(input.request.declaredCapabilityKeys);
  for (const stage of input.model.stages) {
    for (const capabilityKey of stage.requiredCapabilityKeys) {
      if (!capabilities.has(capabilityKey)) {
        issues.push({ path: ["stages", stage.stageId, "requiredCapabilityKeys"], message: `Workflow references an undeclared capability: ${capabilityKey}` });
      }
    }
  }
  if (issues.length > 0) throw new ContractValidationError("specialist.workflow.runtime_validation", issues);
}

export class WorkflowDiscoverySpecialist implements SpecialistExecutor {
  constructor(private readonly dependencies: WorkflowDiscoverySpecialistDependencies) {}

  async execute(input: { assignment: AgentAssignment; specialist: AgentDefinition }): Promise<SpecialistExecutionResponse> {
    if (input.specialist.agentKey !== "workflow_discovery_specialist" || input.specialist.role !== "specialist" || input.specialist.status !== "active") {
      throw new ContractValidationError("specialist.workflow.agent", [{
        path: ["specialist", "agentKey"], message: "Workflow discovery requires the active registered workflow specialist",
      }]);
    }
    if (input.assignment.expectedOutputSchema !== "workflow-model-v1") {
      throw new ContractValidationError("specialist.workflow.assignment", [{
        path: ["expectedOutputSchema"], message: "Workflow discovery requires workflow-model-v1",
      }]);
    }
    const context = this.dependencies.contexts.resolveWorkflowContext(input.assignment);
    const request: WorkflowDiscoveryInput = {
      contractVersion: "workflow-discovery-input-v1",
      assignment: input.assignment,
      goal: context.goal,
      evidence: [...context.evidence],
      declaredCapabilityKeys: [...context.declaredCapabilityKeys],
      constraints: [...input.assignment.constraints],
    };
    this.record("model.requested", input, {
      operation: "workflow_discovery", contextReferenceCount: input.assignment.contextRefs.length,
      evidenceCount: request.evidence.length,
    });
    try {
      const response = await requestValidatedWorkflowModel(this.dependencies.provider, request);
      validateRuntimeOwnedOutput({ assignment: input.assignment, request, model: response.model });
      this.record("model.responded", input, {
        operation: "workflow_discovery", accepted: true,
        workflowId: response.model.workflowId,
        factCount: response.model.facts.length,
        assumptionCount: response.model.assumptions.length,
        unknownCount: response.model.unknowns.length,
      });
      const provenance = response.model.evidenceReferences.map((item) => item.sourceRef);
      const evidenceRefs: DataRef[] = [...provenance, { kind: "step_output", id: input.assignment.stepId }];
      return {
        result: agentResultSchema.parse({
          executionId: input.assignment.executionId,
          stepId: input.assignment.stepId,
          status: "completed",
          output: response.model,
          evidenceRefs,
          confidence: response.model.unknowns.length === 0 ? 1 : 0.8,
          unmetCriteria: [],
        }),
        usage: response.usage,
      };
    } catch (error) {
      this.record("model.responded", input, { operation: "workflow_discovery", accepted: false });
      throw error;
    }
  }

  private record(
    type: "model.requested" | "model.responded",
    input: { assignment: AgentAssignment; specialist: AgentDefinition },
    payload: Record<string, unknown>,
  ): void {
    this.dependencies.events.record({
      type,
      executionId: input.assignment.executionId,
      actor: { kind: "runtime", id: "workflow-specialist-runtime" },
      versionRefs: { specialist: input.specialist.versionId },
      payload: { stepId: input.assignment.stepId, attempt: input.assignment.attempt, ...payload },
      occurredAt: this.dependencies.now(),
    });
  }
}
