import "server-only";

import {
  normalizedFeedbackSchema,
  observationEvidenceSchema,
  observationSchema,
  type NormalizedFeedback,
  type Observation,
  type ObservationEvidence,
} from "./observation-contracts";

function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) immutable(nested);
    Object.freeze(value);
  }
  return value;
}

export class ObservationStore {
  private readonly evidence = new Map<string, ObservationEvidence>();
  private readonly observations = new Map<string, Observation>();
  private readonly feedback = new Map<string, NormalizedFeedback>();

  registerEvidence(input: unknown): ObservationEvidence {
    const record = observationEvidenceSchema.parse(input);
    if (this.evidence.has(record.evidenceId)) throw new Error(`Evidence already exists: ${record.evidenceId}`);
    for (const parentId of record.parentEvidenceIds) {
      const parent = this.evidence.get(parentId);
      if (!parent) throw new Error(`Unknown parent evidence: ${parentId}`);
      if (parent.productKey !== record.productKey || parent.productSnapshotId !== record.productSnapshotId) {
        throw new Error(`Cross-product or cross-snapshot evidence is forbidden: ${parentId}`);
      }
      if (parent.sourceType === "hypothesis" || parent.sourceType === "candidate") {
        throw new Error(`Generated proposal cannot become source evidence: ${parentId}`);
      }
    }
    this.assertNoCircularPath(record.evidenceId, record.parentEvidenceIds);
    const stored = immutable(structuredClone(record));
    this.evidence.set(stored.evidenceId, stored);
    return stored;
  }

  recordObservation(input: unknown): Observation {
    const observation = observationSchema.parse(input);
    if (this.observations.has(observation.observationId)) throw new Error(`Observation already exists: ${observation.observationId}`);
    for (const evidenceId of observation.evidenceIds) {
      const evidence = this.evidence.get(evidenceId);
      if (!evidence) throw new Error(`Unknown observation evidence: ${evidenceId}`);
      if (evidence.productKey !== observation.productKey || evidence.productVersionId !== observation.productVersionId || evidence.productSnapshotId !== observation.productSnapshotId) {
        throw new Error(`Observation evidence crosses product/version context: ${evidenceId}`);
      }
      if (observation.executionId && evidence.executionId && observation.executionId !== evidence.executionId) {
        throw new Error(`Observation evidence crosses execution context: ${evidenceId}`);
      }
      if (evidence.sourceType === "hypothesis" || evidence.sourceType === "candidate") {
        throw new Error(`Proposal output is not primary observation evidence: ${evidenceId}`);
      }
    }
    const stored = immutable(structuredClone(observation));
    this.observations.set(stored.observationId, stored);
    return stored;
  }

  recordFeedback(input: unknown): NormalizedFeedback {
    const feedback = normalizedFeedbackSchema.parse(input);
    if (this.feedback.has(feedback.feedbackId)) throw new Error(`Feedback already exists: ${feedback.feedbackId}`);
    const source = this.evidence.get(feedback.sourceEvidenceId);
    if (!source || (source.sourceType !== "user_feedback" && source.sourceType !== "operator_feedback")) {
      throw new Error("Normalized feedback requires registered user/operator feedback evidence");
    }
    const allEvidenceIds = [feedback.sourceEvidenceId, ...feedback.contradictoryEvidenceIds];
    for (const evidenceId of allEvidenceIds) {
      const evidence = this.evidence.get(evidenceId);
      if (!evidence) throw new Error(`Unknown feedback evidence: ${evidenceId}`);
      if (evidence.productKey !== feedback.productKey || evidence.productVersionId !== feedback.productVersionId || evidence.productSnapshotId !== feedback.productSnapshotId) {
        throw new Error(`Feedback evidence crosses product/version context: ${evidenceId}`);
      }
    }
    const stored = immutable(structuredClone(feedback));
    this.feedback.set(stored.feedbackId, stored);
    return stored;
  }

  requireEvidence(evidenceId: string): ObservationEvidence {
    const evidence = this.evidence.get(evidenceId);
    if (!evidence) throw new Error(`Unknown evidence: ${evidenceId}`);
    return evidence;
  }

  requireObservation(observationId: string): Observation {
    const observation = this.observations.get(observationId);
    if (!observation) throw new Error(`Unknown observation: ${observationId}`);
    return observation;
  }

  private assertNoCircularPath(evidenceId: string, parents: readonly string[]): void {
    const visit = (current: string, seen: Set<string>): void => {
      if (current === evidenceId) throw new Error("Circular evidence graph is forbidden");
      if (seen.has(current)) return;
      seen.add(current);
      for (const parent of this.evidence.get(current)?.parentEvidenceIds ?? []) visit(parent, seen);
    };
    for (const parent of parents) visit(parent, new Set());
  }
}
