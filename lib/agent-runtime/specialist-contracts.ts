import "server-only";

import { z } from "zod";

import { agentAssignmentSchema, dataRefSchema, riskLevelSchema } from "./contracts";

const idSchema = z.string().trim().min(1).max(200);
const keySchema = z.string().trim().min(1).max(160).regex(/^[a-z][a-z0-9._-]*$/);
const textSchema = z.string().trim().min(1).max(4_000);
const conciseSummarySchema = z.string().trim().min(1).max(2_000);

function uniqueIds<T>(items: readonly T[], id: (item: T) => string, label: string, context: z.RefinementCtx): void {
  const values = items.map(id);
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: `${label} IDs must be unique` });
}

export const workflowEvidenceReferenceSchema = z.object({
  evidenceId: idSchema,
  sourceKind: z.enum(["goal_input", "prerequisite_output", "product_context"]),
  sourceRef: dataRefSchema,
  description: textSchema,
  digest: z.string().trim().min(1).max(256).optional(),
}).strict();

export const workflowActorSchema = z.object({
  actorId: idSchema,
  name: z.string().trim().min(1).max(200),
  role: textSchema,
  evidenceRefs: z.array(idSchema).min(1).max(100),
}).strict();

export const workflowDecisionSchema = z.object({
  decisionId: idSchema,
  stageId: idSchema,
  condition: textSchema,
  outcomes: z.array(z.object({ value: textSchema, nextStageId: idSchema.optional() }).strict()).min(2).max(20),
  humanRequired: z.boolean(),
  evidenceRefs: z.array(idSchema).max(100),
}).strict();

export const workflowDependencySchema = z.object({
  dependencyId: idSchema,
  fromStageId: idSchema,
  toStageId: idSchema,
  type: z.enum(["data", "control", "approval"]),
  description: textSchema,
}).strict();

export const workflowConstraintSchema = z.object({
  constraintId: idSchema,
  description: textSchema,
  classification: z.enum(["fact", "assumption"]),
  evidenceRefs: z.array(idSchema).max(100),
}).strict();

export const workflowAssumptionSchema = z.object({
  assumptionId: idSchema,
  statement: textSchema,
  reason: textSchema,
  impact: textSchema,
  evidenceRefs: z.array(idSchema).max(100),
}).strict();

export const workflowUnknownSchema = z.object({
  unknownId: idSchema,
  question: textSchema,
  impact: textSchema,
}).strict();

export const workflowSuccessCriterionSchema = z.object({
  criterionId: idSchema,
  metricKey: keySchema,
  operator: z.enum(["eq", "gte", "lte", "contains", "exists"]),
  target: z.union([z.string().max(1_000), z.number().finite(), z.boolean()]),
  unit: z.string().trim().min(1).max(100),
  evidenceRefs: z.array(idSchema).max(100),
}).strict();

export const workflowFailureConditionSchema = z.object({
  failureId: idSchema,
  description: textSchema,
  stageId: idSchema.optional(),
  detectableSignal: keySchema,
  recoveryOwnerActorId: idSchema.optional(),
}).strict();

export const workflowHumanCheckpointSchema = z.object({
  checkpointId: idSchema,
  stageId: idSchema,
  trigger: textSchema,
  approvalType: z.enum(["human", "explicit_human"]),
  responsibleHumanRole: textSchema,
  evidenceRefs: z.array(idSchema).max(100),
}).strict();

export const workflowStageSchema = z.object({
  stageId: idSchema,
  name: z.string().trim().min(1).max(200),
  objective: textSchema,
  actorIds: z.array(idSchema).min(1).max(50),
  inputIds: z.array(idSchema).max(100),
  outputIds: z.array(idSchema).max(100),
  dependsOnStageIds: z.array(idSchema).max(100),
  decisionIds: z.array(idSchema).max(100),
  requiredCapabilityKeys: z.array(keySchema).max(100),
  humanCheckpointIds: z.array(idSchema).max(50),
  evidenceRefs: z.array(idSchema).min(1).max(100),
}).strict();

export const workflowDiscoveryInputSchema = z.object({
  contractVersion: z.literal("workflow-discovery-input-v1"),
  assignment: agentAssignmentSchema,
  goal: z.object({ goalId: idSchema, objective: textSchema }).strict(),
  evidence: z.array(workflowEvidenceReferenceSchema).min(1).max(500),
  declaredCapabilityKeys: z.array(keySchema).max(500),
  constraints: z.array(textSchema).max(100),
}).strict();

export const workflowModelSchema = z.object({
  contractVersion: z.literal("workflow-model-v1"),
  workflowId: idSchema,
  executionId: idSchema,
  stepId: idSchema,
  status: z.literal("draft"),
  objective: textSchema,
  actors: z.array(workflowActorSchema).min(1).max(100),
  inputs: z.array(z.object({ inputId: idSchema, name: textSchema, evidenceRefs: z.array(idSchema).min(1).max(100) }).strict()).min(1).max(200),
  outputs: z.array(z.object({ outputId: idSchema, name: textSchema, evidenceRefs: z.array(idSchema).max(100) }).strict()).min(1).max(200),
  stages: z.array(workflowStageSchema).min(1).max(200),
  decisions: z.array(workflowDecisionSchema).max(200),
  dependencies: z.array(workflowDependencySchema).max(500),
  constraints: z.array(workflowConstraintSchema).max(100),
  facts: z.array(z.object({ factId: idSchema, statement: textSchema, evidenceRefs: z.array(idSchema).min(1).max(100) }).strict()).min(1).max(500),
  assumptions: z.array(workflowAssumptionSchema).max(200),
  unknowns: z.array(workflowUnknownSchema).max(200),
  successCriteria: z.array(workflowSuccessCriterionSchema).min(1).max(100),
  failureConditions: z.array(workflowFailureConditionSchema).min(1).max(200),
  humanCheckpoints: z.array(workflowHumanCheckpointSchema).max(100),
  evidenceReferences: z.array(workflowEvidenceReferenceSchema).min(1).max(500),
  decisionSummary: conciseSummarySchema,
}).strict().superRefine((model, context) => {
  uniqueIds(model.actors, (item) => item.actorId, "Actor", context);
  uniqueIds(model.stages, (item) => item.stageId, "Stage", context);
  uniqueIds(model.decisions, (item) => item.decisionId, "Decision", context);
  uniqueIds(model.dependencies, (item) => item.dependencyId, "Dependency", context);
  uniqueIds(model.inputs, (item) => item.inputId, "Input", context);
  uniqueIds(model.outputs, (item) => item.outputId, "Output", context);
  uniqueIds(model.constraints, (item) => item.constraintId, "Constraint", context);
  uniqueIds(model.facts, (item) => item.factId, "Fact", context);
  uniqueIds(model.assumptions, (item) => item.assumptionId, "Assumption", context);
  uniqueIds(model.unknowns, (item) => item.unknownId, "Unknown", context);
  uniqueIds(model.successCriteria, (item) => item.criterionId, "Success criterion", context);
  uniqueIds(model.failureConditions, (item) => item.failureId, "Failure condition", context);
  uniqueIds(model.humanCheckpoints, (item) => item.checkpointId, "Human checkpoint", context);
  uniqueIds(model.evidenceReferences, (item) => item.evidenceId, "Evidence", context);
  const actors = new Set(model.actors.map((item) => item.actorId));
  const stages = new Set(model.stages.map((item) => item.stageId));
  const decisions = new Set(model.decisions.map((item) => item.decisionId));
  const evidence = new Set(model.evidenceReferences.map((item) => item.evidenceId));
  const inputs = new Set(model.inputs.map((item) => item.inputId));
  const outputs = new Set(model.outputs.map((item) => item.outputId));
  const checkpoints = new Map(model.humanCheckpoints.map((item) => [item.checkpointId, item]));
  const checkEvidence = (refs: readonly string[], label: string) => {
    for (const ref of refs) if (!evidence.has(ref)) context.addIssue({ code: "custom", message: `${label} references unknown evidence: ${ref}` });
  };
  for (const actor of model.actors) checkEvidence(actor.evidenceRefs, `Actor ${actor.actorId}`);
  for (const item of model.inputs) checkEvidence(item.evidenceRefs, `Input ${item.inputId}`);
  for (const item of model.outputs) checkEvidence(item.evidenceRefs, `Output ${item.outputId}`);
  for (const item of model.constraints) checkEvidence(item.evidenceRefs, `Constraint ${item.constraintId}`);
  for (const fact of model.facts) checkEvidence(fact.evidenceRefs, `Fact ${fact.factId}`);
  for (const item of model.assumptions) checkEvidence(item.evidenceRefs, `Assumption ${item.assumptionId}`);
  for (const item of model.successCriteria) checkEvidence(item.evidenceRefs, `Success criterion ${item.criterionId}`);
  for (const item of model.humanCheckpoints) checkEvidence(item.evidenceRefs, `Human checkpoint ${item.checkpointId}`);
  for (const stage of model.stages) {
    for (const id of stage.actorIds) if (!actors.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown actor: ${id}` });
    for (const id of stage.dependsOnStageIds) if (!stages.has(id) || id === stage.stageId) context.addIssue({ code: "custom", message: `Stage has invalid dependency: ${id}` });
    for (const id of stage.decisionIds) if (!decisions.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown decision: ${id}` });
    for (const id of stage.humanCheckpointIds) {
      const checkpoint = checkpoints.get(id);
      if (!checkpoint || checkpoint.stageId !== stage.stageId) context.addIssue({ code: "custom", message: `Stage references invalid human checkpoint: ${id}` });
    }
    for (const id of stage.inputIds) if (!inputs.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown input: ${id}` });
    for (const id of stage.outputIds) if (!outputs.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown output: ${id}` });
    checkEvidence(stage.evidenceRefs, `Stage ${stage.stageId}`);
  }
  for (const decision of model.decisions) {
    if (!stages.has(decision.stageId)) context.addIssue({ code: "custom", message: `Decision references unknown stage: ${decision.stageId}` });
    for (const outcome of decision.outcomes) if (outcome.nextStageId && !stages.has(outcome.nextStageId)) context.addIssue({ code: "custom", message: `Decision outcome references unknown stage: ${outcome.nextStageId}` });
    checkEvidence(decision.evidenceRefs, `Decision ${decision.decisionId}`);
  }
  for (const dependency of model.dependencies) {
    if (!stages.has(dependency.fromStageId) || !stages.has(dependency.toStageId) || dependency.fromStageId === dependency.toStageId) {
      context.addIssue({ code: "custom", message: `Workflow dependency is invalid: ${dependency.dependencyId}` });
    }
  }
  for (const failure of model.failureConditions) {
    if (failure.stageId && !stages.has(failure.stageId)) context.addIssue({ code: "custom", message: `Failure condition references unknown stage: ${failure.stageId}` });
    if (failure.recoveryOwnerActorId && !actors.has(failure.recoveryOwnerActorId)) context.addIssue({ code: "custom", message: `Failure condition references unknown actor: ${failure.recoveryOwnerActorId}` });
  }
  for (const checkpoint of model.humanCheckpoints) {
    if (!stages.has(checkpoint.stageId)) context.addIssue({ code: "custom", message: `Human checkpoint references unknown stage: ${checkpoint.stageId}` });
  }
  const dependencyGraph = new Map(model.stages.map((stage) => [stage.stageId, new Set(stage.dependsOnStageIds)]));
  for (const dependency of model.dependencies) dependencyGraph.get(dependency.toStageId)?.add(dependency.fromStageId);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stageId: string): boolean => {
    if (visiting.has(stageId)) return true;
    if (visited.has(stageId)) return false;
    visiting.add(stageId);
    for (const dependencyId of dependencyGraph.get(stageId) ?? []) if (visit(dependencyId)) return true;
    visiting.delete(stageId);
    visited.add(stageId);
    return false;
  };
  if (model.stages.some((stage) => visit(stage.stageId))) {
    context.addIssue({ code: "custom", message: "Workflow stage dependencies must be acyclic" });
  }
});

export const capabilityRequirementSchema = z.object({
  capabilityKey: keySchema,
  reason: textSchema,
  required: z.boolean(),
  evidenceRefs: z.array(idSchema).min(1).max(100),
}).strict();

export const toolRequirementSchema = z.object({
  toolKey: keySchema,
  purpose: textSchema,
  capabilityKey: keySchema,
  riskLevel: riskLevelSchema,
  approvalType: z.enum(["none", "human", "explicit_human"]),
}).strict().superRefine((tool, context) => {
  if (tool.riskLevel === "high" && tool.approvalType !== "explicit_human") context.addIssue({ code: "custom", message: "High-risk tools require explicit human approval" });
  if (tool.riskLevel === "medium" && tool.approvalType === "none") context.addIssue({ code: "custom", message: "Medium-risk tools require human approval" });
});

export const contextBoundarySchema = z.object({
  boundaryId: idSchema,
  ownerAgentId: idSchema,
  allowedReferenceIds: z.array(idSchema).max(500),
  allowedRefKinds: z.array(z.enum(["goal_input", "step_output", "product_context", "artifact"])).min(1).max(4),
  maxItems: z.number().int().min(1).max(1_000),
  sensitiveData: z.enum(["forbidden", "redacted", "allowed_by_policy"]),
}).strict();

export const agentHandoffSchema = z.object({
  handoffId: idSchema,
  fromAgentId: idSchema,
  toAgentId: idSchema,
  condition: textSchema,
  contextBoundaryId: idSchema,
  outputContract: keySchema,
}).strict();

export const proposedAgentSchema = z.object({
  proposedAgentId: idSchema,
  name: z.string().trim().min(1).max(200),
  responsibility: textSchema,
  capabilityRequirements: z.array(capabilityRequirementSchema).max(100),
  toolRequirements: z.array(toolRequirementSchema).max(100),
  inputContextBoundaryIds: z.array(idSchema).max(100),
  outputContextBoundaryIds: z.array(idSchema).max(100),
  riskLevel: riskLevelSchema,
}).strict();

export const approvalRequirementSchema = z.object({
  approvalRequirementId: idSchema,
  trigger: textSchema,
  riskLevel: riskLevelSchema,
  approvalType: z.enum(["human", "explicit_human"]),
  responsibleHumanRole: textSchema,
}).strict().superRefine((approval, context) => {
  if (approval.riskLevel === "high" && approval.approvalType !== "explicit_human") context.addIssue({ code: "custom", message: "High-risk actions require explicit human approval" });
});

export const verificationResponsibilitySchema = z.object({
  verificationId: idSchema,
  responsibleAgentId: idSchema,
  criterionId: idSchema,
  requiredEvidenceRefs: z.array(idSchema).min(1).max(100),
}).strict();

export const recoveryStrategySchema = z.object({
  recoveryId: idSchema,
  failureType: keySchema,
  strategy: z.enum(["retry", "replan", "human_escalation", "fail_closed"]),
  retryLimit: z.number().int().min(0).max(10),
  humanEscalation: z.boolean(),
}).strict();

export const outcomeDefinitionSchema = z.object({
  outcomeId: idSchema,
  metricKey: keySchema,
  target: z.union([z.string().max(1_000), z.number().finite(), z.boolean()]),
  evaluatorRef: keySchema,
}).strict();

export const agentArchitectureInputSchema = z.object({
  contractVersion: z.literal("agent-architecture-input-v1"),
  assignment: agentAssignmentSchema,
  verifiedWorkflowModel: workflowModelSchema,
  productSnapshotId: idSchema,
  availableCapabilityKeys: z.array(keySchema).max(1_000),
  availableToolKeys: z.array(keySchema).max(1_000),
  productContextReferenceIds: z.array(idSchema).max(1_000),
  constraints: z.array(textSchema).max(100),
}).strict();

export const agentSystemProposalSchema = z.object({
  contractVersion: z.literal("agent-system-proposal-v1"),
  proposalId: idSchema,
  executionId: idSchema,
  stepId: idSchema,
  status: z.literal("proposal"),
  sourceWorkflowId: idSchema,
  productSnapshotId: idSchema,
  agents: z.array(proposedAgentSchema).min(1).max(50),
  handoffs: z.array(agentHandoffSchema).max(200),
  contextBoundaries: z.array(contextBoundarySchema).min(1).max(200),
  approvalRequirements: z.array(approvalRequirementSchema).max(100),
  verificationResponsibilities: z.array(verificationResponsibilitySchema).min(1).max(100),
  recoveryStrategies: z.array(recoveryStrategySchema).min(1).max(100),
  outcomes: z.array(outcomeDefinitionSchema).min(1).max(100),
  decisionSummary: conciseSummarySchema,
}).strict().superRefine((proposal, context) => {
  uniqueIds(proposal.agents, (item) => item.proposedAgentId, "Proposed agent", context);
  uniqueIds(proposal.handoffs, (item) => item.handoffId, "Handoff", context);
  uniqueIds(proposal.contextBoundaries, (item) => item.boundaryId, "Context boundary", context);
  const agents = new Set(proposal.agents.map((item) => item.proposedAgentId));
  const boundaries = new Map(proposal.contextBoundaries.map((item) => [item.boundaryId, item]));
  for (const agent of proposal.agents) {
    for (const id of [...agent.inputContextBoundaryIds, ...agent.outputContextBoundaryIds]) {
      const boundary = boundaries.get(id);
      if (!boundary || boundary.ownerAgentId !== agent.proposedAgentId) context.addIssue({ code: "custom", message: `Agent references an invalid context boundary: ${id}` });
    }
  }
  for (const handoff of proposal.handoffs) {
    if (!agents.has(handoff.fromAgentId) || !agents.has(handoff.toAgentId) || handoff.fromAgentId === handoff.toAgentId) context.addIssue({ code: "custom", message: `Handoff references invalid agents: ${handoff.handoffId}` });
    if (!boundaries.has(handoff.contextBoundaryId)) context.addIssue({ code: "custom", message: `Handoff references unknown context boundary: ${handoff.contextBoundaryId}` });
    const boundary = boundaries.get(handoff.contextBoundaryId);
    const source = proposal.agents.find((item) => item.proposedAgentId === handoff.fromAgentId);
    if (boundary && (boundary.ownerAgentId !== handoff.fromAgentId || !source?.outputContextBoundaryIds.includes(handoff.contextBoundaryId))) {
      context.addIssue({ code: "custom", message: `Handoff must use a declared source-agent output boundary: ${handoff.handoffId}` });
    }
  }
  for (const verification of proposal.verificationResponsibilities) {
    if (!agents.has(verification.responsibleAgentId)) context.addIssue({ code: "custom", message: `Verification references unknown agent: ${verification.responsibleAgentId}` });
  }
});

export type WorkflowEvidenceReference = z.infer<typeof workflowEvidenceReferenceSchema>;
export type WorkflowActor = z.infer<typeof workflowActorSchema>;
export type WorkflowStage = z.infer<typeof workflowStageSchema>;
export type WorkflowDecision = z.infer<typeof workflowDecisionSchema>;
export type WorkflowDependency = z.infer<typeof workflowDependencySchema>;
export type WorkflowConstraint = z.infer<typeof workflowConstraintSchema>;
export type WorkflowAssumption = z.infer<typeof workflowAssumptionSchema>;
export type WorkflowUnknown = z.infer<typeof workflowUnknownSchema>;
export type WorkflowSuccessCriterion = z.infer<typeof workflowSuccessCriterionSchema>;
export type WorkflowFailureCondition = z.infer<typeof workflowFailureConditionSchema>;
export type WorkflowHumanCheckpoint = z.infer<typeof workflowHumanCheckpointSchema>;
export type WorkflowDiscoveryInput = z.infer<typeof workflowDiscoveryInputSchema>;
export type WorkflowModel = z.infer<typeof workflowModelSchema>;
export type CapabilityRequirement = z.infer<typeof capabilityRequirementSchema>;
export type ToolRequirement = z.infer<typeof toolRequirementSchema>;
export type ProposedAgent = z.infer<typeof proposedAgentSchema>;
export type AgentHandoff = z.infer<typeof agentHandoffSchema>;
export type ContextBoundary = z.infer<typeof contextBoundarySchema>;
export type ApprovalRequirement = z.infer<typeof approvalRequirementSchema>;
export type VerificationResponsibility = z.infer<typeof verificationResponsibilitySchema>;
export type RecoveryStrategy = z.infer<typeof recoveryStrategySchema>;
export type OutcomeDefinition = z.infer<typeof outcomeDefinitionSchema>;
export type AgentArchitectureInput = z.infer<typeof agentArchitectureInputSchema>;
export type AgentSystemProposal = z.infer<typeof agentSystemProposalSchema>;
