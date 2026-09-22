import type { AgentArchitectureInput, AgentSystemProposal, WorkflowDiscoveryInput, WorkflowModel } from "../../lib/agent-runtime/specialist-contracts";

export const fixtureNow = "2026-09-22T00:00:00.000Z";

export function workflowInput(): WorkflowDiscoveryInput {
  return {
    contractVersion: "workflow-discovery-input-v1",
    assignment: {
      executionId: "execution-1", stepId: "workflow-step", attempt: 1,
      objective: "Discover the onboarding workflow.",
      contextRefs: [{ kind: "goal_input", id: "brief" }], constraints: ["Read only"],
      expectedOutputSchema: "workflow-model-v1", deadlineAt: "2026-09-22T00:01:00.000Z",
    },
    goal: { goalId: "goal-1", objective: "Model customer onboarding." },
    evidence: [{
      evidenceId: "evidence-brief", sourceKind: "goal_input",
      sourceRef: { kind: "goal_input", id: "brief" }, description: "Supplied onboarding brief.",
    }],
    declaredCapabilityKeys: ["onboarding.record.read"],
    constraints: ["Read only"],
  };
}

export function workflowModel(): WorkflowModel {
  return {
    contractVersion: "workflow-model-v1", workflowId: "workflow-1",
    executionId: "execution-1", stepId: "workflow-step", status: "draft",
    objective: "Model customer onboarding.",
    actors: [{ actorId: "actor-operator", name: "Operator", role: "Reviews onboarding requests.", evidenceRefs: ["evidence-brief"] }],
    inputs: [{ inputId: "input-request", name: "Customer request", evidenceRefs: ["evidence-brief"] }],
    outputs: [{ outputId: "output-decision", name: "Onboarding decision", evidenceRefs: ["evidence-brief"] }],
    stages: [{
      stageId: "stage-review", name: "Review", objective: "Review the supplied request.",
      actorIds: ["actor-operator"], inputIds: ["input-request"], outputIds: ["output-decision"],
      dependsOnStageIds: [], decisionIds: [], requiredCapabilityKeys: ["onboarding.record.read"],
      humanCheckpointIds: ["checkpoint-approval"], evidenceRefs: ["evidence-brief"],
    }],
    decisions: [], dependencies: [],
    constraints: [{ constraintId: "constraint-read-only", description: "No external writes.", classification: "fact", evidenceRefs: ["evidence-brief"] }],
    facts: [{ factId: "fact-human-review", statement: "An operator reviews requests.", evidenceRefs: ["evidence-brief"] }],
    assumptions: [{ assumptionId: "assumption-format", statement: "Requests use a consistent format.", reason: "A draft model needs an input shape.", impact: "Parsing may require revision.", evidenceRefs: [] }],
    unknowns: [{ unknownId: "unknown-volume", question: "What is the request volume?", impact: "Capacity requirements remain unknown." }],
    successCriteria: [{ criterionId: "criterion-decision", metricKey: "onboarding.decision.exists", operator: "exists", target: true, unit: "boolean", evidenceRefs: ["evidence-brief"] }],
    failureConditions: [{ failureId: "failure-missing-request", description: "Request evidence is missing.", stageId: "stage-review", detectableSignal: "onboarding.request.missing", recoveryOwnerActorId: "actor-operator" }],
    humanCheckpoints: [{ checkpointId: "checkpoint-approval", stageId: "stage-review", trigger: "Before a consequential onboarding decision.", approvalType: "explicit_human", responsibleHumanRole: "Onboarding operator", evidenceRefs: ["evidence-brief"] }],
    evidenceReferences: workflowInput().evidence,
    decisionSummary: "The supplied evidence supports a single human-reviewed draft stage; volume remains unknown.",
  };
}

export function architectureInput(): AgentArchitectureInput {
  return {
    contractVersion: "agent-architecture-input-v1",
    assignment: {
      executionId: "execution-1", stepId: "architecture-step", attempt: 1,
      objective: "Propose a bounded agent architecture.",
      contextRefs: [{ kind: "step_output", id: "workflow-step" }], constraints: ["Proposal only"],
      expectedOutputSchema: "agent-system-proposal-v1", deadlineAt: "2026-09-22T00:01:00.000Z",
    },
    verifiedWorkflowModel: workflowModel(), productSnapshotId: "product-snapshot-1",
    availableCapabilityKeys: ["onboarding.record.read"], availableToolKeys: ["onboarding.record.read-tool"],
    productContextReferenceIds: ["product-context-onboarding"], constraints: ["Proposal only"],
  };
}

export function architectureProposal(): AgentSystemProposal {
  return {
    contractVersion: "agent-system-proposal-v1", proposalId: "proposal-1",
    executionId: "execution-1", stepId: "architecture-step", status: "proposal",
    sourceWorkflowId: "workflow-1", productSnapshotId: "product-snapshot-1",
    agents: [{
      proposedAgentId: "proposed-reviewer", name: "Review Assistant",
      responsibility: "Prepare a read-only review draft for the human operator.",
      capabilityRequirements: [{ capabilityKey: "onboarding.record.read", reason: "Read supplied requests.", required: true, evidenceRefs: ["evidence-brief"] }],
      toolRequirements: [{ toolKey: "onboarding.record.read-tool", purpose: "Read the registered request.", capabilityKey: "onboarding.record.read", riskLevel: "low", approvalType: "none" }],
      inputContextBoundaryIds: ["boundary-review"], outputContextBoundaryIds: ["boundary-review"], riskLevel: "low",
    }],
    handoffs: [],
    contextBoundaries: [{
      boundaryId: "boundary-review", ownerAgentId: "proposed-reviewer",
      allowedReferenceIds: ["product-context-onboarding", "workflow-step"],
      allowedRefKinds: ["step_output", "product_context"], maxItems: 10, sensitiveData: "redacted",
    }],
    approvalRequirements: [{
      approvalRequirementId: "approval-human-decision", trigger: "Any consequential onboarding decision.",
      riskLevel: "high", approvalType: "explicit_human", responsibleHumanRole: "Onboarding operator",
    }],
    verificationResponsibilities: [{
      verificationId: "verification-architecture", responsibleAgentId: "proposed-reviewer",
      criterionId: "criterion-decision", requiredEvidenceRefs: ["evidence-brief"],
    }],
    recoveryStrategies: [{ recoveryId: "recovery-read", failureType: "tool.read_failed", strategy: "fail_closed", retryLimit: 0, humanEscalation: true }],
    outcomes: [{ outcomeId: "outcome-decision", metricKey: "onboarding.decision.exists", target: true, evaluatorRef: "onboarding.evaluator.v1" }],
    decisionSummary: "The proposal uses one read-only assistant and preserves explicit human authority for consequential decisions.",
  };
}
