import "server-only";

import type { AgentAssignment, DataRef } from "./contracts";
import type { WorkflowEvidenceReference } from "./specialist-contracts";
import { ContractValidationError } from "./validation";

export interface WorkflowAssignmentContext {
  readonly goal: { readonly goalId: string; readonly objective: string };
  readonly evidence: readonly WorkflowEvidenceReference[];
  readonly declaredCapabilityKeys: readonly string[];
}

export interface WorkflowContextResolver {
  resolveWorkflowContext(assignment: AgentAssignment): WorkflowAssignmentContext;
}

interface WorkflowContextRegistration extends WorkflowAssignmentContext {
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
export class InMemorySpecialistContextStore implements WorkflowContextResolver {
  readonly #workflowContexts = new Map<string, WorkflowContextRegistration>();

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
}
