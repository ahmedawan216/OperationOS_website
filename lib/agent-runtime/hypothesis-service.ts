import "server-only";

import type { ResolvedProductContext } from "./product-registry";
import type { DetectionClassification } from "./environment-contracts";
import {
  evidencePatternSchema,
  hypothesisRequestSchema,
  hypothesisSchema,
  type EvidencePattern,
  type Hypothesis,
  type HypothesisRequest,
} from "./hypothesis-contracts";
import { ObservationStore } from "./observation-store";
import { parseContract } from "./validation";
import { LearningProviderError } from "./learning-errors";

export interface HypothesisProvider {
  proposeHypothesis(request: HypothesisRequest): Promise<{ readonly output: unknown }>;
}

export function aggregateEvidence(input: {
  patternId: string;
  detection: DetectionClassification;
  counterEvidenceIds?: readonly string[];
  store: ObservationStore;
}): EvidencePattern {
  for (const observationId of input.detection.observationIds) {
    const observation = input.store.requireObservation(observationId);
    if (observation.productKey !== input.detection.productKey || observation.productSnapshotId !== input.detection.productSnapshotId) throw new Error("Pattern observation crosses product context");
  }
  const counterEvidenceIds = [...(input.counterEvidenceIds ?? [])];
  for (const evidenceId of [...input.detection.evidenceIds, ...counterEvidenceIds]) {
    const evidence = input.store.requireEvidence(evidenceId);
    if (evidence.productKey !== input.detection.productKey || evidence.productSnapshotId !== input.detection.productSnapshotId) throw new Error("Pattern evidence crosses product context");
  }
  const eligible = input.detection.classification !== "insufficient_evidence"
    && input.detection.evidenceStrength !== "insufficient"
    && input.detection.observationIds.length >= 2;
  return evidencePatternSchema.parse({
    contractVersion: "evidence-pattern-v1",
    patternId: input.patternId,
    productKey: input.detection.productKey,
    productSnapshotId: input.detection.productSnapshotId,
    subject: input.detection.subject,
    classification: input.detection.classification,
    epistemicStatus: eligible ? "hypothesized" : "unknown",
    window: input.detection.window,
    observationIds: input.detection.observationIds,
    supportEvidenceIds: input.detection.evidenceIds,
    counterEvidenceIds,
    supportCount: input.detection.observationIds.length,
    eligibleForHypothesis: eligible,
    decisionSummary: eligible ? "Related observations are grouped as evidence for a hypothesis proposal." : "Evidence is retained as an observation pattern only.",
  });
}

export async function requestValidatedHypothesis(input: {
  provider: HypothesisProvider;
  request: HypothesisRequest;
  store: ObservationStore;
  productContext: ResolvedProductContext;
}): Promise<Hypothesis> {
  const request = parseContract(hypothesisRequestSchema, input.request, "hypothesis.request");
  if (!request.pattern.eligibleForHypothesis) throw new Error("Pattern is not eligible for hypothesis formation");
  if (request.pattern.productKey !== input.productContext.product.productKey || request.pattern.productSnapshotId !== input.productContext.snapshot.productSnapshotId) throw new Error("Hypothesis request crosses product context");
  const capabilities = new Set(input.productContext.capabilities.map((item) => item.capabilityKey));
  const workflows = new Set(input.productContext.workflows.map((item) => item.workflowKey));
  for (const key of request.affectedCapabilityKeys) if (!capabilities.has(key)) throw new Error(`Hypothesis references unavailable capability: ${key}`);
  for (const key of request.affectedWorkflowKeys) if (!workflows.has(key)) throw new Error(`Hypothesis references unavailable workflow: ${key}`);
  let response: { readonly output: unknown };
  try {
    response = await input.provider.proposeHypothesis(request);
  } catch {
    throw new LearningProviderError("Hypothesis");
  }
  const hypothesis = parseContract(hypothesisSchema, response.output, "hypothesis.response");
  if (hypothesis.hypothesisId !== request.hypothesisId || hypothesis.patternId !== request.pattern.patternId) throw new Error("Hypothesis provider changed runtime-owned identity");
  if (hypothesis.productKey !== request.pattern.productKey || hypothesis.productVersionId !== request.productVersionId || hypothesis.productSnapshotId !== request.pattern.productSnapshotId) throw new Error("Hypothesis provider changed product context");
  for (const evidenceId of [...hypothesis.supportEvidenceIds, ...hypothesis.counterEvidenceIds]) {
    const evidence = input.store.requireEvidence(evidenceId);
    if (evidence.productKey !== hypothesis.productKey || evidence.productSnapshotId !== hypothesis.productSnapshotId) throw new Error("Hypothesis evidence crosses product context");
    if (evidence.sourceType === "hypothesis" || evidence.sourceType === "candidate") throw new Error("Generated proposal cannot support a hypothesis");
  }
  const allowedSupport = new Set(request.pattern.supportEvidenceIds);
  const allowedCounter = new Set(request.pattern.counterEvidenceIds);
  for (const evidenceId of hypothesis.supportEvidenceIds) if (!allowedSupport.has(evidenceId)) throw new Error(`Hypothesis fabricated support evidence: ${evidenceId}`);
  for (const evidenceId of hypothesis.counterEvidenceIds) if (!allowedCounter.has(evidenceId)) throw new Error(`Hypothesis omitted or fabricated counter-evidence: ${evidenceId}`);
  if (hypothesis.counterEvidenceIds.length !== request.pattern.counterEvidenceIds.length) throw new Error("Hypothesis must preserve all counter-evidence");
  if (hypothesis.confidenceBand === "high" && request.pattern.supportCount < 5) throw new Error("Hypothesis confidence exceeds available evidence strength");
  if (hypothesis.affectedCapabilityKeys.some((key) => !request.affectedCapabilityKeys.includes(key))) throw new Error("Hypothesis expanded affected capabilities");
  if (hypothesis.affectedWorkflowKeys.some((key) => !request.affectedWorkflowKeys.includes(key))) throw new Error("Hypothesis expanded affected workflows");
  return deepFreeze(structuredClone(hypothesis));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export class DeterministicHypothesisProvider implements HypothesisProvider {
  async proposeHypothesis(request: HypothesisRequest): Promise<{ readonly output: unknown }> {
    return {
      output: {
        contractVersion: "hypothesis-v1",
        hypothesisId: request.hypothesisId,
        patternId: request.pattern.patternId,
        status: "proposed",
        epistemicStatus: "hypothesized",
        productKey: request.pattern.productKey,
        productVersionId: request.productVersionId,
        productSnapshotId: request.pattern.productSnapshotId,
        subject: request.pattern.subject,
        problemStatement: "Repeated bounded evidence suggests a workflow weakness that requires independent evaluation.",
        supportEvidenceIds: request.pattern.supportEvidenceIds,
        counterEvidenceIds: request.pattern.counterEvidenceIds,
        affectedCapabilityKeys: request.affectedCapabilityKeys,
        affectedWorkflowKeys: request.affectedWorkflowKeys,
        expectedOutcomeSignalKey: request.expectedOutcomeSignalKey,
        confidenceBand: request.pattern.supportCount >= 5 ? "medium" : "low",
        uncertainties: ["The observations establish correlation, not causation."],
        proposedExperiment: "Compare a bounded candidate against the immutable baseline on fixed evaluation cases.",
        optimizationObjective: "Reduce verified failures without changing safety or evaluation criteria.",
        riskClassification: "low",
        decisionSummary: "Proposes a testable explanation while preserving uncertainty and counter-evidence.",
        createdAt: request.createdAt,
      },
    };
  }
}
