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
  evidenceReferences: z.array(workflowEvidenceReferenceSchema).min(1).max(500),
  decisionSummary: conciseSummarySchema,
}).strict().superRefine((model, context) => {
  uniqueIds(model.actors, (item) => item.actorId, "Actor", context);
  uniqueIds(model.stages, (item) => item.stageId, "Stage", context);
  uniqueIds(model.decisions, (item) => item.decisionId, "Decision", context);
  uniqueIds(model.dependencies, (item) => item.dependencyId, "Dependency", context);
  uniqueIds(model.evidenceReferences, (item) => item.evidenceId, "Evidence", context);
  const actors = new Set(model.actors.map((item) => item.actorId));
  const stages = new Set(model.stages.map((item) => item.stageId));
  const decisions = new Set(model.decisions.map((item) => item.decisionId));
  const evidence = new Set(model.evidenceReferences.map((item) => item.evidenceId));
  const inputs = new Set(model.inputs.map((item) => item.inputId));
  const outputs = new Set(model.outputs.map((item) => item.outputId));
  const checkEvidence = (refs: readonly string[], label: string) => {
    for (const ref of refs) if (!evidence.has(ref)) context.addIssue({ code: "custom", message: `${label} references unknown evidence: ${ref}` });
  };
  for (const actor of model.actors) checkEvidence(actor.evidenceRefs, `Actor ${actor.actorId}`);
  for (const fact of model.facts) checkEvidence(fact.evidenceRefs, `Fact ${fact.factId}`);
  for (const stage of model.stages) {
    for (const id of stage.actorIds) if (!actors.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown actor: ${id}` });
    for (const id of stage.dependsOnStageIds) if (!stages.has(id) || id === stage.stageId) context.addIssue({ code: "custom", message: `Stage has invalid dependency: ${id}` });
    for (const id of stage.decisionIds) if (!decisions.has(id)) context.addIssue({ code: "custom", message: `Stage references unknown decision: ${id}` });
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
  agents: z.array(z.object({
    proposedAgentId: idSchema,
    name: z.string().trim().min(1).max(200),
    responsibility: textSchema,
    capabilityRequirements: z.array(capabilityRequirementSchema).max(100),
    toolRequirements: z.array(toolRequirementSchema).max(100),
    inputContextBoundaryIds: z.array(idSchema).max(100),
    outputContextBoundaryIds: z.array(idSchema).max(100),
    riskLevel: riskLevelSchema,
  }).strict()).min(1).max(50),
  handoffs: z.array(agentHandoffSchema).max(200),
  contextBoundaries: z.array(contextBoundarySchema).min(1).max(200),
  approvalRequirements: z.array(z.object({
    approvalRequirementId: idSchema,
    trigger: textSchema,
    riskLevel: riskLevelSchema,
    approvalType: z.enum(["human", "explicit_human"]),
    responsibleHumanRole: textSchema,
  }).strict().superRefine((approval, context) => {
    if (approval.riskLevel === "high" && approval.approvalType !== "explicit_human") context.addIssue({ code: "custom", message: "High-risk actions require explicit human approval" });
  })).max(100),
  verificationResponsibilities: z.array(z.object({
    verificationId: idSchema,
    responsibleAgentId: idSchema,
    criterionId: idSchema,
    requiredEvidenceRefs: z.array(idSchema).min(1).max(100),
  }).strict()).min(1).max(100),
  recoveryStrategies: z.array(z.object({
    recoveryId: idSchema,
    failureType: keySchema,
    strategy: z.enum(["retry", "replan", "human_escalation", "fail_closed"]),
    retryLimit: z.number().int().min(0).max(10),
    humanEscalation: z.boolean(),
  }).strict()).min(1).max(100),
  outcomes: z.array(z.object({
    outcomeId: idSchema,
    metricKey: keySchema,
    target: z.union([z.string().max(1_000), z.number().finite(), z.boolean()]),
    evaluatorRef: keySchema,
  }).strict()).min(1).max(100),
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
  }
  for (const verification of proposal.verificationResponsibilities) {
    if (!agents.has(verification.responsibleAgentId)) context.addIssue({ code: "custom", message: `Verification references unknown agent: ${verification.responsibleAgentId}` });
  }
});

export type WorkflowEvidenceReference = z.infer<typeof workflowEvidenceReferenceSchema>;
export type WorkflowDiscoveryInput = z.infer<typeof workflowDiscoveryInputSchema>;
export type WorkflowModel = z.infer<typeof workflowModelSchema>;
export type AgentArchitectureInput = z.infer<typeof agentArchitectureInputSchema>;
export type AgentSystemProposal = z.infer<typeof agentSystemProposalSchema>;
