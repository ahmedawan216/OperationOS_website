import "server-only";

import type { ControlPlaneSnapshot } from "./contracts";
import type { MetaAgentProvider } from "./meta-agent";
import type { MetaAgentQuery } from "./meta-agent-contracts";

export class GroundedMetaAgentProvider implements MetaAgentProvider {
  async respond(query: MetaAgentQuery, snapshot: ControlPlaneSnapshot) {
    const question = query.question.toLowerCase();
    const base = {
      contractVersion: "meta-agent-answer-v1" as const,
      queryId: query.queryId,
      answerId: `answer-${query.queryId}`,
      readOnly: true as const,
      approvalGranted: false as const,
      deploymentAuthorized: false as const,
      permissionGranted: false as const,
      policyMutationAllowed: false as const,
      evidenceMutationAllowed: false as const,
    };
    if (question.includes("learn")) {
      const hypothesis = snapshot.learnings.find((item) => item.epistemicStatus === "hypothesized");
      const fact = snapshot.learnings.find((item) => item.epistemicStatus === "known");
      if (!fact && !hypothesis) return this.unknown(base, "No known or hypothesized learning records are available.");
      return { ...base, summary: "Recorded learning evidence is separated by epistemic status.", claims: [
        ...(fact ? [{ classification: "fact" as const, statement: fact.summary, recordReferences: [{ kind: "observation" as const, id: fact.recordId }] }] : []),
        ...(hypothesis ? [{ classification: "hypothesis" as const, statement: hypothesis.summary, recordReferences: [{ kind: "observation" as const, id: hypothesis.recordId }] }] : []),
      ] };
    }
    if (question.includes("approval") || question.includes("approve")) {
      const approval = snapshot.approvals.find((item) => item.status === "pending");
      return approval ? { ...base, summary: "An exact action-bound request needs founder review. I cannot approve it.", claims: [{ classification: "fact" as const, statement: `${approval.actionType} is ${approval.status}.`, recordReferences: [{ kind: "approval" as const, id: approval.approvalId }] }], proposedAction: { actionType: "inspect_record" as const, subjectId: approval.approvalId, executed: false as const, requiresFounderConfirmation: true as const } } : this.unknown(base, "No pending approval exists in the available records.");
    }
    if (question.includes("known-good") || question.includes("known good")) {
      const version = snapshot.versions.find((item) => item.pointer === "known_good");
      return version ? { ...base, summary: `${version.versionId} is the recorded known-good version.`, claims: [{ classification: "fact" as const, statement: `${version.versionId} is referenced by the known-good pointer.`, recordReferences: [{ kind: "version" as const, id: version.versionId }] }] } : this.unknown(base, "No known-good version record is available.");
    }
    if (question.includes("improvement") || question.includes("candidate")) {
      const candidate = snapshot.improvements[0];
      return candidate ? { ...base, summary: "This is a recorded shadow improvement, not an active production change.",
        claims: [{ classification: "fact" as const,
          statement: `${candidate.candidateId} targets ${candidate.targetComponent} from baseline ${candidate.baselineVersionId}.`,
          recordReferences: [{ kind: "candidate" as const, id: candidate.candidateId }] }] }
        : this.unknown(base, "No improvement candidate is present in the authorized records.");
    }
    if (question.includes("evaluation") || question.includes("risk gate")) {
      const evaluation = snapshot.evaluations[0];
      return evaluation ? { ...base, summary: "The independent evaluation and deterministic Risk Gate are recorded separately from the optimizer.",
        claims: [{ classification: "fact" as const,
          statement: `${evaluation.evaluationId} is ${evaluation.status}; Risk Gate decision: ${evaluation.riskGateDecision}.`,
          recordReferences: [{ kind: "evaluation" as const, id: evaluation.evaluationId }] }] }
        : this.unknown(base, "No completed evaluation is present in the authorized records.");
    }
    if (question.includes("safety") || question.includes("guardian")) {
      const safety = snapshot.safety[0];
      return safety ? { ...base, summary: "Guardian advice and runtime disposition remain separate.",
        claims: [{ classification: "fact" as const,
          statement: `${safety.assessmentId}: Guardian ${safety.guardianDisposition}; runtime ${safety.runtimeDisposition}.`,
          recordReferences: [{ kind: "safety" as const, id: safety.assessmentId }] }] }
        : this.unknown(base, "No safety assessment is present in the authorized records.");
    }
    if (question.includes("canary")) {
      const canary = snapshot.canaries[0];
      return canary ? { ...base, summary: "The recorded non-production canary state is grounded in its latest outcome.",
        claims: [{ classification: "fact" as const,
          statement: `${canary.canaryId} is ${canary.state}; frozen rollback target ${canary.rollbackVersionId}.`,
          recordReferences: [{ kind: "canary" as const, id: canary.canaryId }] }] }
        : this.unknown(base, "No canary record is present in the authorized records.");
    }
    if (question.includes("rollback") || question.includes("roll back")) {
      const canary = snapshot.canaries.find((item) => item.state === "canary");
      return canary ? { ...base, summary: "I can identify the frozen rollback target, but cannot execute it.", claims: [{ classification: "fact" as const, statement: `The frozen rollback target is ${canary.rollbackVersionId}.`, recordReferences: [{ kind: "canary" as const, id: canary.canaryId }, { kind: "version" as const, id: canary.rollbackVersionId }] }], proposedAction: { actionType: "request_canary_rollback" as const, subjectId: canary.canaryId, executed: false as const, requiresFounderConfirmation: true as const } } : this.unknown(base, "No active canary with a frozen rollback target is available.");
    }
    return this.unknown(base, "The available sanitized records do not answer that question.");
  }

  private unknown(base: {
    contractVersion: "meta-agent-answer-v1"; queryId: string; answerId: string; readOnly: true;
    approvalGranted: false; deploymentAuthorized: false; permissionGranted: false;
    policyMutationAllowed: false; evidenceMutationAllowed: false;
  }, statement: string) {
    return { ...base, summary: "Evidence is insufficient.", claims: [{ classification: "unknown" as const, statement, recordReferences: [] }] };
  }
}
