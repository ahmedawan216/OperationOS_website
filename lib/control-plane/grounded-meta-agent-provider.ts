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
