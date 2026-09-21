import "server-only";

import {
  agentAssignmentSchema,
  type AgentAssignment,
  type AgentDefinition,
  type ExecutionSnapshot,
  type Plan,
  type PlanStep,
} from "./contracts";
import type { ManagerPlanningRequest, ManagerPlanProposal } from "./manager-contracts";
import type { ImmutableVersionRegistry } from "./registry";

export const managerSpecialistAllowlist = Object.freeze([
  "workflow_discovery_specialist",
  "agent_architecture_specialist",
] as const);

type ManagerSpecialistKey = (typeof managerSpecialistAllowlist)[number];

export interface ValidatedPlanStep {
  readonly step: PlanStep;
  readonly specialist: AgentDefinition;
}

export interface ValidatedManagerPlan {
  readonly plan: Plan;
  readonly snapshot: ExecutionSnapshot;
  readonly decisionSummary: string;
  readonly orderedSteps: readonly ValidatedPlanStep[];
}

function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

function requireRoutableSpecialist(input: {
  key: string;
  snapshotVersionIds: readonly string[];
  agents: ImmutableVersionRegistry<AgentDefinition>;
}): AgentDefinition {
  if (!managerSpecialistAllowlist.includes(input.key as ManagerSpecialistKey)) {
    throw new Error(`Manager proposed an unknown specialist: ${input.key}`);
  }
  const specialist = input.agents
    .listVersions()
    .find((agent) => agent.agentKey === input.key && input.snapshotVersionIds.includes(agent.versionId));
  if (!specialist || specialist.role !== "specialist" || specialist.status !== "active") {
    throw new Error(`Specialist is not active in the execution snapshot: ${input.key}`);
  }
  return specialist;
}

function validateDependencies(steps: readonly PlanStep[]): readonly PlanStep[] {
  const byId = new Map(steps.map((step) => [step.stepId, step]));
  if (byId.size !== steps.length) throw new Error("Plan step IDs must be unique");
  if (new Set(steps.map((step) => step.sequence)).size !== steps.length) {
    throw new Error("Plan step sequences must be unique");
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PlanStep[] = [];
  const visit = (step: PlanStep): void => {
    if (visiting.has(step.stepId)) throw new Error("Plan dependencies must be acyclic");
    if (visited.has(step.stepId)) return;
    visiting.add(step.stepId);
    for (const dependencyId of step.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (!dependency) throw new Error(`Unknown step dependency: ${dependencyId}`);
      if (dependencyId === step.stepId) throw new Error("A step cannot depend on itself");
      visit(dependency);
    }
    visiting.delete(step.stepId);
    visited.add(step.stepId);
    ordered.push(step);
  };

  for (const step of [...steps].sort((a, b) => a.sequence - b.sequence || a.stepId.localeCompare(b.stepId))) {
    visit(step);
  }
  return ordered;
}

function validateContextRefs(step: PlanStep, request: ManagerPlanningRequest, stepIds: ReadonlySet<string>): void {
  for (const ref of step.inputRefs) {
    if (ref.kind === "goal_input" && !(ref.id in request.goal.inputs)) {
      throw new Error(`Assignment references an undeclared goal input: ${ref.id}`);
    }
    if (ref.kind === "step_output" && (!stepIds.has(ref.id) || !step.dependsOn.includes(ref.id))) {
      throw new Error(`Assignment references an undeclared dependency output: ${ref.id}`);
    }
    if (ref.kind === "artifact" || ref.kind === "tool_result") {
      throw new Error(`Manager cannot introduce undeclared runtime context: ${ref.kind}:${ref.id}`);
    }
  }
}

export function validateManagerPlan(input: {
  proposal: ManagerPlanProposal;
  request: ManagerPlanningRequest;
  agents: ImmutableVersionRegistry<AgentDefinition>;
}): ValidatedManagerPlan {
  const { plan } = input.proposal;
  if (plan.planId !== input.request.planId) throw new Error("Manager plan ID does not match the runtime request");
  if (plan.executionId !== input.request.snapshot.executionId) {
    throw new Error("Manager plan execution ID does not match the immutable snapshot");
  }
  if (plan.steps.length > input.request.snapshot.maxSteps) throw new Error("Manager plan exceeds the step budget");

  const stepIds = new Set(plan.steps.map((step) => step.stepId));
  for (const verificationStepId of plan.verificationStepIds) {
    if (!stepIds.has(verificationStepId)) throw new Error(`Unknown verification step: ${verificationStepId}`);
  }
  const orderedSteps = validateDependencies(plan.steps).map((step) => {
    validateContextRefs(step, input.request, stepIds);
    const specialist = requireRoutableSpecialist({
      key: step.assignedAgentKey,
      snapshotVersionIds: input.request.snapshot.specialistVersionIds,
      agents: input.agents,
    });
    const grantedCapabilities = new Set(specialist.capabilityGrants.map((grant) => grant.capabilityKey));
    for (const capability of step.requiredCapabilities) {
      if (!grantedCapabilities.has(capability)) {
        throw new Error(`Manager cannot grant unauthorized capability: ${capability}`);
      }
    }
    return Object.freeze({ step: immutableCopy(step), specialist: immutableCopy(specialist) });
  });

  return immutableCopy({
    plan,
    snapshot: input.request.snapshot,
    decisionSummary: input.proposal.decisionSummary,
    orderedSteps,
  });
}

export function createSpecialistAssignment(input: {
  executionId: string;
  validatedStep: ValidatedPlanStep;
  attempt: number;
  goalConstraints: readonly string[];
  deadlineAt: string;
}): AgentAssignment {
  return agentAssignmentSchema.parse({
    executionId: input.executionId,
    stepId: input.validatedStep.step.stepId,
    attempt: input.attempt,
    objective: input.validatedStep.step.objective,
    contextRefs: input.validatedStep.step.inputRefs,
    constraints: input.goalConstraints,
    expectedOutputSchema: input.validatedStep.step.expectedOutputSchema,
    deadlineAt: input.deadlineAt,
  });
}
