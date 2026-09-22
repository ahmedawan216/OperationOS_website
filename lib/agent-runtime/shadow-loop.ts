import "server-only";

import { z } from "zod";

import { buildEnvironmentModel, classifyObservations } from "./environment-model";
import { aggregateEvidence, requestValidatedHypothesis, type HypothesisProvider } from "./hypothesis-service";
import type { Observation } from "./observation-contracts";
import { ObservationStore } from "./observation-store";
import type { OptimizerRequest } from "./optimizer-contracts";
import type { ResolvedProductContext } from "./product-registry";
import { createSafetyReviewRequest, reviewCandidateSafety, type SafetyGuardianProvider } from "./safety-guardian";
import { requestValidatedShadowCandidate, type ShadowOptimizerProvider } from "./shadow-optimizer";

const idSchema = z.string().trim().min(1).max(200);
const auditEventSchema = z.object({
  eventId: idSchema,
  sequence: z.number().int().positive(),
  type: z.enum(["observations.validated", "environment.versioned", "pattern.detected", "hypothesis.proposed", "candidate.created", "safety.assessed", "eligibility.decided"]),
  productKey: idSchema,
  productSnapshotId: idSchema,
  subjectId: idSchema,
  evidenceIds: z.array(idSchema).max(10_000),
  decisionSummary: z.string().trim().min(1).max(2_000),
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export const shadowLoopResultSchema = z.object({
  contractVersion: z.literal("shadow-loop-result-v1"),
  environmentModelVersionId: idSchema,
  patternId: idSchema,
  hypothesisId: idSchema,
  candidateId: idSchema,
  assessmentId: idSchema.optional(),
  status: z.literal("shadow"),
  safetyReviewed: z.boolean(),
  evaluationEligible: z.boolean(),
  executable: z.literal(false),
  active: z.literal(false),
  auditEvents: z.array(auditEventSchema).length(7),
}).strict().superRefine((result, context) => {
  result.auditEvents.forEach((event, index) => {
    if (event.sequence !== index + 1) context.addIssue({ code: "custom", message: "Shadow-loop audit events must be ordered and gap-free" });
  });
});

export type ShadowLoopResult = z.infer<typeof shadowLoopResultSchema>;

export async function runShadowImprovementLoop(input: {
  productContext: ResolvedProductContext;
  store: ObservationStore;
  observations: readonly Observation[];
  counterEvidenceIds: readonly string[];
  ids: { environmentModelVersionId: string; detectionId: string; patternId: string; hypothesisId: string; candidateId: string; assessmentId: string };
  affectedCapabilityKeys: readonly string[];
  affectedWorkflowKeys: readonly string[];
  expectedOutcomeSignalKey: string;
  baseline: OptimizerRequest["baseline"];
  optimizationObjective: string;
  allowedAgentKeys: readonly string[];
  allowedModelKeys: readonly string[];
  allowedToolKeys: readonly string[];
  evaluationRequirements: OptimizerRequest["evaluationRequirements"];
  requiredRiskLevel: OptimizerRequest["requiredRiskLevel"];
  hypothesisProvider: HypothesisProvider;
  optimizerProvider: ShadowOptimizerProvider;
  guardianProvider: SafetyGuardianProvider;
  occurredAt: string;
}): Promise<ShadowLoopResult> {
  if (input.observations.length < 2) throw new Error("Shadow improvement loop requires repeated evidence");
  const model = buildEnvironmentModel({ modelVersionId: input.ids.environmentModelVersionId, version: 1, productContext: input.productContext, observations: input.observations, createdAt: input.occurredAt });
  const detection = classifyObservations({ detectionId: input.ids.detectionId, model, observations: input.observations });
  const pattern = aggregateEvidence({ patternId: input.ids.patternId, detection, counterEvidenceIds: input.counterEvidenceIds, store: input.store });
  const hypothesis = await requestValidatedHypothesis({
    provider: input.hypothesisProvider,
    request: {
      contractVersion: "hypothesis-request-v1", hypothesisId: input.ids.hypothesisId, pattern,
      productVersionId: input.productContext.product.versionId,
      affectedCapabilityKeys: [...input.affectedCapabilityKeys], affectedWorkflowKeys: [...input.affectedWorkflowKeys],
      expectedOutcomeSignalKey: input.expectedOutcomeSignalKey, createdAt: input.occurredAt,
    },
    store: input.store, productContext: input.productContext,
  });
  const candidate = await requestValidatedShadowCandidate({
    provider: input.optimizerProvider,
    request: {
      contractVersion: "shadow-optimizer-request-v1", candidateId: input.ids.candidateId, candidateVersion: 1,
      hypothesis, baseline: input.baseline, optimizationObjective: input.optimizationObjective,
      allowedAgentKeys: [...input.allowedAgentKeys], allowedModelKeys: [...input.allowedModelKeys], allowedToolKeys: [...input.allowedToolKeys],
      evaluationRequirements: input.evaluationRequirements, requiredRiskLevel: input.requiredRiskLevel, createdAt: input.occurredAt,
    },
  });
  const availableEvidenceIds = [...new Set([...candidate.evidenceIds, ...candidate.counterEvidenceIds])];
  const reviewRequest = createSafetyReviewRequest({ assessmentId: input.ids.assessmentId, candidate, availableEvidenceIds, assessedAt: input.occurredAt });
  const review = await reviewCandidateSafety({ provider: input.guardianProvider, request: reviewRequest });
  const productKey = input.productContext.product.productKey;
  const snapshotId = input.productContext.snapshot.productSnapshotId;
  const audit = [
    ["observations.validated", input.observations[0]!.observationId, detection.evidenceIds, "Validated bounded observations and provenance."],
    ["environment.versioned", model.modelVersionId, detection.evidenceIds, "Created an immutable product/environment model version."],
    ["pattern.detected", pattern.patternId, pattern.supportEvidenceIds, pattern.decisionSummary],
    ["hypothesis.proposed", hypothesis.hypothesisId, hypothesis.supportEvidenceIds, hypothesis.decisionSummary],
    ["candidate.created", candidate.candidateId, candidate.evidenceIds, candidate.decisionSummary],
    ["safety.assessed", review.assessment?.assessmentId ?? input.ids.assessmentId, reviewRequest.availableEvidenceIds, review.assessment?.rationaleSummary ?? review.eligibility.reason],
    ["eligibility.decided", candidate.candidateId, candidate.evidenceIds, review.eligibility.reason],
  ] as const;
  return deepFreeze(shadowLoopResultSchema.parse({
    contractVersion: "shadow-loop-result-v1", environmentModelVersionId: model.modelVersionId, patternId: pattern.patternId,
    hypothesisId: hypothesis.hypothesisId, candidateId: candidate.candidateId, assessmentId: review.assessment?.assessmentId,
    status: "shadow", safetyReviewed: Boolean(review.assessment), evaluationEligible: review.eligibility.evaluationEligible,
    executable: false, active: false,
    auditEvents: audit.map(([type, subjectId, evidenceIds, decisionSummary], index) => ({ eventId: `shadow-audit-${index + 1}`, sequence: index + 1, type, productKey, productSnapshotId: snapshotId, subjectId, evidenceIds, decisionSummary, occurredAt: input.occurredAt })),
  }));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
