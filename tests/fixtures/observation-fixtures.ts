import type { Observation, ObservationEvidence } from "../../lib/agent-runtime/observation-contracts";

export const observedAt = "2026-09-22T12:00:00.000Z";

export function executionEvidence(overrides: Partial<ObservationEvidence> = {}): ObservationEvidence {
  return {
    contractVersion: "observation-evidence-v1",
    evidenceId: "evidence-execution-1",
    sourceType: "execution_trace",
    sourceId: "trace-1",
    productKey: "operations_suite",
    productVersionId: "operations-suite-product-v2",
    productSnapshotId: "snapshot-v2",
    executionId: "execution-1",
    observedAt,
    digest: "sha256:0123456789abcdef",
    sensitivity: "internal",
    parentEvidenceIds: [],
    ...overrides,
  };
}

export function failureObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    contractVersion: "observation-v1",
    observationId: "observation-failure-1",
    productKey: "operations_suite",
    productVersionId: "operations-suite-product-v2",
    productSnapshotId: "snapshot-v2",
    executionId: "execution-1",
    subject: { subjectType: "capability", subjectKey: "onboarding.record.read" },
    observedAt,
    window: { startedAt: "2026-09-22T11:59:00.000Z", endedAt: observedAt },
    evidenceIds: ["evidence-execution-1"],
    signal: { kind: "failure", signalKey: "verification.failure", summary: "Verification failed once.", errorCode: "verification_failed", retryable: true, count: 1 },
    decisionSummary: "Recorded a runtime verification failure without inferring cause.",
    ...overrides,
  };
}
