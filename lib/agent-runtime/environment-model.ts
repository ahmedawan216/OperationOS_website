import "server-only";

import {
  detectionClassificationSchema,
  productEnvironmentModelSchema,
  type DetectionClassification,
  type ProductEnvironmentModel,
} from "./environment-contracts";
import type { Observation } from "./observation-contracts";
import type { ResolvedProductContext } from "./product-registry";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function evidenceForRegistration(versionId: string): string {
  return `registered:${versionId}`;
}

export class EnvironmentModelRegistry {
  private readonly versions = new Map<string, ProductEnvironmentModel>();

  register(input: unknown): ProductEnvironmentModel {
    const model = productEnvironmentModelSchema.parse(input);
    if (this.versions.has(model.modelVersionId)) throw new Error(`Environment model version already exists: ${model.modelVersionId}`);
    if (model.version === 1 && model.parentModelVersionId) throw new Error("Initial environment model cannot have a parent");
    if (model.version > 1) {
      const parent = model.parentModelVersionId && this.versions.get(model.parentModelVersionId);
      if (!parent) throw new Error("Updated environment model requires an immutable registered parent");
      if (parent.productKey !== model.productKey || parent.productSnapshotId === model.productSnapshotId && parent.version >= model.version) {
        throw new Error("Environment model lineage is invalid");
      }
      if (model.version !== parent.version + 1) throw new Error("Environment model versions must be sequential");
    }
    const stored = deepFreeze(structuredClone(model));
    this.versions.set(stored.modelVersionId, stored);
    return stored;
  }

  require(modelVersionId: string): ProductEnvironmentModel {
    const model = this.versions.get(modelVersionId);
    if (!model) throw new Error(`Unknown environment model version: ${modelVersionId}`);
    return model;
  }
}

export function buildEnvironmentModel(input: {
  modelVersionId: string;
  version: number;
  parentModelVersionId?: string;
  productContext: ResolvedProductContext;
  observations: readonly Observation[];
  createdAt: string;
}): ProductEnvironmentModel {
  const { product, snapshot } = input.productContext;
  for (const observation of input.observations) {
    if (observation.productKey !== product.productKey || observation.productVersionId !== product.versionId || observation.productSnapshotId !== snapshot.productSnapshotId) {
      throw new Error(`Observation is outside the environment model snapshot: ${observation.observationId}`);
    }
  }
  const entities: ProductEnvironmentModel["entities"] = [
    { entityId: `product:${product.productKey}`, entityType: "product", key: product.productKey, registeredVersionId: product.versionId, epistemicStatus: "known", evidenceIds: [evidenceForRegistration(product.versionId)], summary: product.description },
    ...input.productContext.features.map((item) => ({ entityId: `feature:${item.featureKey}`, entityType: "feature" as const, key: item.featureKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
    ...input.productContext.capabilities.map((item) => ({ entityId: `capability:${item.capabilityKey}`, entityType: "capability" as const, key: item.capabilityKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
    ...input.productContext.workflows.map((item) => ({ entityId: `workflow:${item.workflowKey}`, entityType: "workflow" as const, key: item.workflowKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
    ...input.productContext.tools.map((item) => ({ entityId: `tool:${item.toolKey}`, entityType: "tool" as const, key: item.toolKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
    ...input.productContext.signals.map((item) => ({ entityId: `signal:${item.signalKey}`, entityType: "outcome_signal" as const, key: item.signalKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
    ...input.productContext.evaluators.map((item) => ({ entityId: `evaluator:${item.evaluatorKey}`, entityType: "evaluator" as const, key: item.evaluatorKey, registeredVersionId: item.versionId, epistemicStatus: "known" as const, evidenceIds: [evidenceForRegistration(item.versionId)], summary: item.description })),
  ];
  const productEntityId = `product:${product.productKey}`;
  const relationships = entities.slice(1).map((entity) => ({
    relationshipId: `contains:${entity.entityId}`,
    fromEntityId: productEntityId,
    toEntityId: entity.entityId,
    relationshipType: "contains" as const,
    epistemicStatus: "known" as const,
    evidenceIds: entity.evidenceIds,
  }));
  return deepFreeze(productEnvironmentModelSchema.parse({
    contractVersion: "product-environment-model-v1",
    modelVersionId: input.modelVersionId,
    version: input.version,
    ...(input.parentModelVersionId ? { parentModelVersionId: input.parentModelVersionId } : {}),
    productKey: product.productKey,
    productVersionId: product.versionId,
    productSnapshotId: snapshot.productSnapshotId,
    entities,
    relationships,
    sourceObservationIds: input.observations.map((item) => item.observationId).sort(),
    createdAt: input.createdAt,
    createdBy: "runtime",
  }));
}

export function classifyObservations(input: {
  detectionId: string;
  model: ProductEnvironmentModel;
  observations: readonly Observation[];
}): DetectionClassification {
  if (input.observations.length === 0) throw new Error("Detection requires observations");
  const first = input.observations[0]!;
  for (const observation of input.observations) {
    if (observation.productKey !== input.model.productKey || observation.productSnapshotId !== input.model.productSnapshotId) throw new Error("Detection observations cross product context");
    if (observation.subject.subjectType !== first.subject.subjectType || observation.subject.subjectKey !== first.subject.subjectKey) throw new Error("Detection observations must share one subject");
  }
  const kinds = new Set(input.observations.map((item) => item.signal.kind));
  const registeredSubject = input.model.entities.some((entity) => entity.key === first.subject.subjectKey && entity.epistemicStatus === "known");
  let classification: DetectionClassification["classification"] = "insufficient_evidence";
  let strength: DetectionClassification["evidenceStrength"] = "insufficient";
  if (kinds.has("product_change")) {
    classification = "product_change";
    strength = registeredSubject ? "strong" : "weak";
  } else if (kinds.has("feedback")) {
    classification = "explicit_feedback";
    strength = input.observations.length >= 3 ? "moderate" : "weak";
  } else if (kinds.has("anomaly")) {
    classification = input.observations.length >= 2 ? "regression_anomaly" : "insufficient_evidence";
    strength = input.observations.length >= 2 ? "moderate" : "insufficient";
  } else if (kinds.has("failure") && input.observations.length >= 3) {
    classification = "known_weakness";
    strength = "moderate";
  } else if (kinds.has("behavior") && registeredSubject) {
    classification = "novel_behavior";
    strength = input.observations.length >= 2 ? "moderate" : "weak";
  }
  const evidenceIds = [...new Set(input.observations.flatMap((item) => item.evidenceIds))].sort();
  return detectionClassificationSchema.parse({
    contractVersion: "detection-classification-v1",
    detectionId: input.detectionId,
    classification,
    productKey: first.productKey,
    productSnapshotId: first.productSnapshotId,
    subject: first.subject,
    window: {
      startedAt: [...input.observations].map((item) => item.window.startedAt).sort()[0],
      endedAt: [...input.observations].map((item) => item.window.endedAt).sort().at(-1),
    },
    observationIds: input.observations.map((item) => item.observationId).sort(),
    evidenceIds,
    evidenceStrength: strength,
    causalClaim: false,
    decisionSummary: classification === "insufficient_evidence"
      ? "Evidence is retained for observation; no optimization inference is warranted."
      : `Deterministically classified observations as ${classification}; causation is not asserted.`,
  });
}
