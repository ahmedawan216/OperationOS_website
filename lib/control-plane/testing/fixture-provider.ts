import "server-only";
import type { ControlPlaneDataProvider } from "../provider";
import type { ControlPlaneSnapshot } from "../contracts";

const at = "2026-09-22T18:00:00.000Z";
const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;

export const fixtureSnapshot: ControlPlaneSnapshot = {
  contractVersion: "control-plane-snapshot-v1", generatedAt: at, sourceMode: "fixture",
  products: [{ productKey: "operations-suite", name: "Operations Suite", productVersionId: "product-v2", snapshotId: "snapshot-v2", featureCount: 2, capabilityKeys: ["candidate_comparison", "interview_scorecard"], workflowKeys: ["structured_review"], signalKeys: ["review.completed", "review.accepted"], evaluatorKeys: ["workflow.quality.v1", "safety.v1"], recentExecutionCount: 18 }],
  agents: [
    { agentKey: "manager", role: "manager", versionId: "manager-v1", status: "active", capabilityKeys: ["orchestrate"], boundarySummary: "Plans, delegates, recovers, and verifies through the authoritative runtime.", recentExecutionCount: 18 },
    { agentKey: "workflow_discovery_specialist", role: "specialist", versionId: "workflow-v1", status: "active", capabilityKeys: ["workflow_discovery"], boundarySummary: "Draft workflow models from declared evidence only.", recentExecutionCount: 12 },
    { agentKey: "agent_architecture_specialist", role: "specialist", versionId: "architecture-v1", status: "active", capabilityKeys: ["agent_architecture"], boundarySummary: "Proposes bounded agent systems; cannot deploy them.", recentExecutionCount: 10 },
    { agentKey: "shadow_optimizer", role: "optimizer", versionId: "optimizer-v1", status: "active", capabilityKeys: ["bounded_candidate_proposal"], boundarySummary: "Proposes shadow-only immutable improvements.", recentExecutionCount: 3 },
    { agentKey: "safety_guardian", role: "guardian", versionId: "guardian-v1", status: "active", capabilityKeys: ["advisory_safety_review"], boundarySummary: "Advisory assessment; runtime and Risk Gate enforce.", recentExecutionCount: 3 },
  ],
  executions: [
    { executionId: "exec-018", productKey: "operations-suite", goalSummary: "Model a structured review workflow", state: "succeeded", agentKeys: ["manager", "workflow_discovery_specialist", "agent_architecture_specialist"], startedAt: "2026-09-22T17:40:00.000Z", completedAt: "2026-09-22T17:41:12.000Z", retries: 0, replans: 0, verificationStatus: "passed", outcomeSignalKeys: ["review.completed"], traceEventCount: 28 },
    { executionId: "exec-017", productKey: "operations-suite", goalSummary: "Evaluate bounded routing adjustment", state: "failed", agentKeys: ["manager", "workflow_discovery_specialist"], startedAt: "2026-09-22T16:54:00.000Z", completedAt: "2026-09-22T16:55:31.000Z", retries: 1, replans: 1, verificationStatus: "failed", sanitizedError: "Required verification evidence was not produced.", outcomeSignalKeys: [], traceEventCount: 19 },
  ],
  learnings: [
    { recordId: "obs-retry-01", kind: "observation", epistemicStatus: "known", productKey: "operations-suite", summary: "Three verified retries occurred at the workflow handoff stage.", evidenceIds: ["trace-104", "trace-119", "trace-127"], counterEvidenceIds: [], observedAt: "2026-09-22T16:58:00.000Z" },
    { recordId: "hyp-routing-01", kind: "hypothesis", epistemicStatus: "hypothesized", productKey: "operations-suite", summary: "More explicit routing context may reduce handoff retries.", evidenceIds: ["trace-104", "trace-119", "trace-127"], counterEvidenceIds: ["trace-131"], uncertainty: "The sample remains small and does not establish causation.", observedAt: "2026-09-22T17:05:00.000Z" },
    { recordId: "unknown-scorecard-01", kind: "environment_change", epistemicStatus: "unknown", productKey: "operations-suite", summary: "The newly registered interview scorecard capability has insufficient behavioral history.", evidenceIds: ["product-change-22"], counterEvidenceIds: [], uncertainty: "Awaiting representative execution evidence.", observedAt: "2026-09-22T17:10:00.000Z" },
  ],
  improvements: [{ candidateId: "candidate-routing-v1", productKey: "operations-suite", targetComponent: "routing", baselineVersionId: "manager-v1", objective: "Reduce verified handoff retries without widening context.", boundedChangeSummary: "Prefer the registered workflow specialist when declared evidence includes stage dependencies.", risk: "medium", safetyStatus: "require_human_review", lifecycleState: "awaiting_approval", executable: false }],
  evaluations: [{ productKey:"operations-suite", evaluationId: "eval-routing-v1", candidateId: "candidate-routing-v1", baselineVersionId: "manager-v1", datasetVersionId: "routing-dataset-v1", evaluatorVersionIds: ["workflow.quality.v1", "safety.v1", "latency.v1"], status: "improved", metricSummary: [{ key: "workflow.success", baseline: .72, candidate: .86, result: "improved" }, { key: "latency.ms", baseline: 940, candidate: 910, result: "improved" }, { key: "safety.pass", baseline: 1, candidate: 1, result: "unchanged" }], regressionIds: [], riskGateDecision: "require_human_approval" }],
  safety: [{ productKey:"operations-suite", assessmentId: "safety-routing-v1", candidateId: "candidate-routing-v1", severity: "medium", guardianDisposition: "require_human_review", runtimeDisposition: "awaiting exact action-bound approval", findingSummaries: ["Routing behavior changes require bounded canary review."], evidenceIds: ["eval-routing-v1", "trace-104"], assessedAt: "2026-09-22T17:24:00.000Z" }],
  approvals: [{ productKey:"operations-suite", approvalId: "approval-canary-v1", actionType: "candidate.canary.start", subjectId: "candidate-routing-v1", actionDigest: digestB, payloadSummary: "Start a 5% non-production preview canary for candidate-routing-v1 against manager-v1.", risk: "medium", status: "pending", expiresAt: "2026-09-23T18:00:00.000Z", evaluationId: "eval-routing-v1", assessmentId: "safety-routing-v1" }],
  versions: [{ productKey:"operations-suite", versionId: "manager-v1", status: "known_good", digest: digestA, pointer: "known_good", createdAt: "2026-09-21T12:00:00.000Z" }, { productKey:"operations-suite", versionId: "candidate-routing-v1", status: "candidate", digest: digestB, pointer: "none", createdAt: "2026-09-22T17:12:00.000Z" }],
  canaries: [{ productKey:"operations-suite", canaryId: "canary-history-01", state: "rolled_back", candidateVersionId: "candidate-timeout-v1", knownGoodVersionId: "manager-v1", rollbackVersionId: "manager-v1", target: "preview", allocationPercent: 5, productionActivationAllowed: false, eventSummaries: ["Canary started in preview.", "Latency threshold breached.", "Rolled back to manager-v1."] }],
  health: { state: "attention", successRate: .89, verificationFailures: 1, retries: 3, replans: 1, providerFailures: 0, openSafetyFindings: 1, traceStoreHealthy: true, measuredAt: at },
  recentEvents: [
    { eventId: "event-1", severity: "attention", summary: "Exact canary approval is waiting for the founder.", occurredAt: "2026-09-22T17:28:00.000Z", reference: { kind: "approval", id: "approval-canary-v1" } },
    { eventId: "event-2", severity: "info", summary: "Independent evaluation established measurable improvement.", occurredAt: "2026-09-22T17:23:00.000Z", reference: { kind: "evaluation", id: "eval-routing-v1" } },
  ],
};

export const fixtureControlPlaneProvider: ControlPlaneDataProvider = {
  mode: "fixture",
  async readSnapshot({ productKey }) {
    if (!productKey) return structuredClone(fixtureSnapshot);
    const snapshot = structuredClone(fixtureSnapshot);
    snapshot.products = snapshot.products.filter((item) => item.productKey === productKey);
    snapshot.executions = snapshot.executions.filter((item) => item.productKey === productKey);
    snapshot.learnings = snapshot.learnings.filter((item) => item.productKey === productKey);
    snapshot.improvements = snapshot.improvements.filter((item) => item.productKey === productKey);
    snapshot.evaluations = snapshot.evaluations.filter((item) => item.productKey === productKey);
    snapshot.safety = snapshot.safety.filter((item) => item.productKey === productKey);
    snapshot.approvals = snapshot.approvals.filter((item) => item.productKey === productKey);
    snapshot.versions = snapshot.versions.filter((item) => item.productKey === productKey);
    snapshot.canaries = snapshot.canaries.filter((item) => item.productKey === productKey);
    return snapshot;
  },
};
