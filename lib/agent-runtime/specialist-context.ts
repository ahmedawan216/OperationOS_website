import "server-only";

import type { AgentAssignment, DataRef } from "./contracts";
import type { ResolvedProductContext } from "./product-registry";
import type { WorkflowEvidenceReference, WorkflowModel } from "./specialist-contracts";
import { ContractValidationError } from "./validation";

export interface WorkflowAssignmentContext {
  readonly goal: { readonly goalId: string; readonly objective: string };
  readonly evidence: readonly WorkflowEvidenceReference[];
  readonly declaredCapabilityKeys: readonly string[];
}

export interface WorkflowContextResolver {
  resolveWorkflowContext(assignment: AgentAssignment): WorkflowAssignmentContext;
}

export interface VerifiedWorkflowContext {
  readonly model: WorkflowModel;
  readonly sourceRef: DataRef;
  readonly verifierVersionId: string;
  readonly verifiedAt: string;
}

export interface ArchitectureAssignmentContext {
  readonly verifiedWorkflow: VerifiedWorkflowContext;
  readonly productContext: ResolvedProductContext;
}

export interface ArchitectureContextResolver {
  resolveArchitectureContext(assignment: AgentAssignment): ArchitectureAssignmentContext;
}

interface WorkflowContextRegistration extends WorkflowAssignmentContext {
  readonly executionId: string;
}

interface ArchitectureContextRegistration extends ArchitectureAssignmentContext {
  readonly executionId: string;
}

function refKey(ref: DataRef): string {
  return `${ref.kind}:${ref.id}:${ref.digest ?? ""}`;
}

function frozenClone<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (current: unknown): void => {
    if (!current || typeof current !== "object" || Object.isFrozen(current)) return;
    Object.freeze(current);
    for (const child of Object.values(current)) freeze(child);
  };
  freeze(clone);
  return clone;
}

/** Runtime-owned resolver that selects only references declared on an assignment. */
export class InMemorySpecialistContextStore implements WorkflowContextResolver, ArchitectureContextResolver {
  readonly #workflowContexts = new Map<string, WorkflowContextRegistration>();
  readonly #architectureContexts = new Map<string, ArchitectureContextRegistration>();

  registerWorkflowContext(context: WorkflowContextRegistration): void {
    if (this.#workflowContexts.has(context.executionId)) {
      throw new Error(`Workflow context is already registered: ${context.executionId}`);
    }
    this.#workflowContexts.set(context.executionId, frozenClone(context));
  }

  resolveWorkflowContext(assignment: AgentAssignment): WorkflowAssignmentContext {
    const context = this.#workflowContexts.get(assignment.executionId);
    if (!context) throw new ContractValidationError("specialist.workflow.context", [{
      path: ["executionId"], message: "No runtime-owned workflow context exists for this execution",
    }]);

    const available = new Map(context.evidence.map((item) => [refKey(item.sourceRef), item]));
    const selected = assignment.contextRefs.map((ref, index) => {
      const evidence = available.get(refKey(ref));
      if (!evidence) throw new ContractValidationError("specialist.workflow.context", [{
        path: ["assignment", "contextRefs", index], message: "Assignment reference is not available in bounded workflow context",
      }]);
      return evidence;
    });
    return frozenClone({
      goal: context.goal,
      evidence: selected,
      declaredCapabilityKeys: context.declaredCapabilityKeys,
    });
  }

  registerArchitectureContext(context: ArchitectureContextRegistration): void {
    if (this.#architectureContexts.has(context.executionId)) {
      throw new Error(`Architecture context is already registered: ${context.executionId}`);
    }
    if (context.verifiedWorkflow.model.executionId !== context.executionId) {
      throw new Error("Verified workflow execution ID must match its architecture context");
    }
    if (context.verifiedWorkflow.sourceRef.kind !== "step_output" ||
      context.verifiedWorkflow.sourceRef.id !== context.verifiedWorkflow.model.stepId) {
      throw new Error("Verified workflow source must be its runtime step output");
    }
    this.#architectureContexts.set(context.executionId, frozenClone(context));
  }

  resolveArchitectureContext(assignment: AgentAssignment): ArchitectureAssignmentContext {
    const context = this.#architectureContexts.get(assignment.executionId);
    if (!context) throw new ContractValidationError("specialist.architecture.context", [{
      path: ["executionId"], message: "No runtime-verified architecture context exists for this execution",
    }]);
    const sourceKey = refKey(context.verifiedWorkflow.sourceRef);
    if (!assignment.contextRefs.some((ref) => refKey(ref) === sourceKey)) {
      throw new ContractValidationError("specialist.architecture.context", [{
        path: ["assignment", "contextRefs"], message: "Assignment does not declare the verified workflow output",
      }]);
    }
    const unrelated = assignment.contextRefs.find((ref) => refKey(ref) !== sourceKey);
    if (unrelated) throw new ContractValidationError("specialist.architecture.context", [{
      path: ["assignment", "contextRefs"], message: "Architecture assignment includes unrelated context",
    }]);
    return frozenClone({
      verifiedWorkflow: context.verifiedWorkflow,
      productContext: context.productContext,
    });
  }
}
