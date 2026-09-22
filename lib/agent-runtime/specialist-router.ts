import "server-only";

import { agentResultSchema, type AgentAssignment, type AgentDefinition } from "./contracts";
import type { SpecialistExecutor, SpecialistExecutionResponse } from "./manager-execution";
import type { ResolvedProductContext } from "./product-registry";
import type { RuntimeEventSink } from "./runtime";
import { InMemorySpecialistContextStore } from "./specialist-context";
import { workflowModelSchema } from "./specialist-contracts";
import { ContractValidationError, parseContract } from "./validation";

export interface ExecutionProductContextResolver {
  resolveProductContext(executionId: string): ResolvedProductContext;
}

export interface WorkflowModelVerification {
  readonly verifierVersionId: string;
  verify(input: {
    assignment: AgentAssignment;
    response: SpecialistExecutionResponse;
    productContext: ResolvedProductContext;
  }): ReturnType<typeof workflowModelSchema.parse>;
}

/** Deterministic runtime verification before a workflow can become architecture input. */
export class RegisteredWorkflowModelVerifier implements WorkflowModelVerification {
  readonly verifierVersionId = "registered-workflow-model-verifier-v1";

  verify(input: {
    assignment: AgentAssignment;
    response: SpecialistExecutionResponse;
    productContext: ResolvedProductContext;
  }) {
    const result = parseContract(agentResultSchema, input.response.result, "specialist.router.workflow_result");
    if (result.status !== "completed" || result.executionId !== input.assignment.executionId || result.stepId !== input.assignment.stepId) {
      throw new ContractValidationError("specialist.router.workflow_result", [{
        path: ["status", "executionId", "stepId"], message: "Only the completed assigned workflow result can be verified",
      }]);
    }
    const model = parseContract(workflowModelSchema, result.output, "specialist.router.workflow_model");
    if (model.executionId !== input.assignment.executionId || model.stepId !== input.assignment.stepId) {
      throw new ContractValidationError("specialist.router.workflow_model", [{
        path: ["executionId", "stepId"], message: "Workflow identity must match the runtime assignment",
      }]);
    }
    if (!result.evidenceRefs.some((ref) => ref.kind === "step_output" && ref.id === input.assignment.stepId)) {
      throw new ContractValidationError("specialist.router.workflow_evidence", [{
        path: ["evidenceRefs"], message: "Verified workflow result must include its runtime-owned step output",
      }]);
    }
    const resultEvidence = new Set(result.evidenceRefs.map((ref) => `${ref.kind}:${ref.id}:${ref.digest ?? ""}`));
    for (const evidence of model.evidenceReferences) {
      const key = `${evidence.sourceRef.kind}:${evidence.sourceRef.id}:${evidence.sourceRef.digest ?? ""}`;
      if (!resultEvidence.has(key)) throw new ContractValidationError("specialist.router.workflow_evidence", [{
        path: ["evidenceReferences", evidence.evidenceId], message: "Workflow evidence provenance is not present on the runtime result",
      }]);
    }
    const capabilities = new Set(input.productContext.capabilities.map((item) => item.capabilityKey));
    for (const stage of model.stages) {
      for (const capabilityKey of stage.requiredCapabilityKeys) {
        if (!capabilities.has(capabilityKey)) throw new ContractValidationError("specialist.router.workflow_capabilities", [{
          path: ["stages", stage.stageId, "requiredCapabilityKeys"], message: `Workflow capability is not registered in the product snapshot: ${capabilityKey}`,
        }]);
      }
    }
    return model;
  }
}

/** Routes the two locked specialist keys and promotes only verified workflow outputs to dependent context. */
export class SpecialistExecutionRouter implements SpecialistExecutor {
  constructor(private readonly dependencies: {
    workflow: SpecialistExecutor;
    architecture: SpecialistExecutor;
    contexts: InMemorySpecialistContextStore;
    products: ExecutionProductContextResolver;
    workflowVerifier: WorkflowModelVerification;
    events: RuntimeEventSink;
    now: () => string;
  }) {}

  async execute(input: { assignment: AgentAssignment; specialist: AgentDefinition }): Promise<SpecialistExecutionResponse> {
    if (input.specialist.agentKey === "workflow_discovery_specialist") {
      const response = await this.dependencies.workflow.execute(input);
      const productContext = this.dependencies.products.resolveProductContext(input.assignment.executionId);
      let model: ReturnType<typeof workflowModelSchema.parse>;
      try {
        model = this.dependencies.workflowVerifier.verify({ assignment: input.assignment, response, productContext });
        this.recordWorkflowVerification(input, true, model.workflowId, productContext.snapshot.productVersionId);
      } catch (error) {
        this.recordWorkflowVerification(input, false, undefined, productContext.snapshot.productVersionId);
        throw error;
      }
      this.dependencies.contexts.registerArchitectureContext({
        executionId: input.assignment.executionId,
        verifiedWorkflow: {
          model,
          sourceRef: { kind: "step_output", id: input.assignment.stepId },
          verifierVersionId: this.dependencies.workflowVerifier.verifierVersionId,
          verifiedAt: this.dependencies.now(),
        },
        productContext,
      });
      return response;
    }
    if (input.specialist.agentKey === "agent_architecture_specialist") {
      return this.dependencies.architecture.execute(input);
    }
    throw new ContractValidationError("specialist.router.agent", [{
      path: ["specialist", "agentKey"], message: "Runtime router permits only the two registered specialist keys",
    }]);
  }

  private recordWorkflowVerification(
    input: { assignment: AgentAssignment; specialist: AgentDefinition },
    verified: boolean,
    workflowId: string | undefined,
    productVersionId: string,
  ): void {
    this.dependencies.events.record({
      type: "verification.completed",
      executionId: input.assignment.executionId,
      actor: { kind: "runtime", id: "workflow-model-verifier" },
      versionRefs: {
        specialist: input.specialist.versionId,
        verifier: this.dependencies.workflowVerifier.verifierVersionId,
        product: productVersionId,
      },
      payload: {
        kind: "workflow_model", stepId: input.assignment.stepId,
        attempt: input.assignment.attempt, verified, workflowId,
      },
      occurredAt: this.dependencies.now(),
    });
  }
}
