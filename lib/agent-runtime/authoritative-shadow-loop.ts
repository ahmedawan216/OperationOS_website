import "server-only";

import { observationEvidenceSchema, observationSchema } from "./observation-contracts";
import { ObservationStore } from "./observation-store";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";
import { runShadowImprovementLoop } from "./shadow-loop";

/** Rehydrate the provider's bounded context from committed immutable sources,
 * preserving primary evidence and counter-evidence without caller fabrication. */
export async function loadAuthoritativeObservationContext(input: {
  writer: AuthoritativeLifecycleWriter;
  observationIds: readonly string[]; counterEvidenceIds: readonly string[];
  productKey: string; productSnapshotId: string;
}) {
  if (!input.observationIds.length || input.observationIds.length > 500 ||
    input.counterEvidenceIds.length > 500 ||
    new Set(input.observationIds).size !== input.observationIds.length) {
    throw new Error("Authoritative observation context is missing, duplicate, or unbounded");
  }
  const store = new ObservationStore();
  const registered = new Set<string>();
  const visiting = new Set<string>();
  const registerEvidence = async (id: string): Promise<void> => {
    if (registered.has(id)) return;
    if (visiting.has(id) || registered.size + visiting.size >= 2_000) {
      throw new Error("Circular or unbounded authoritative evidence graph");
    }
    visiting.add(id);
    const evidence = observationEvidenceSchema.parse((await input.writer.requireSource(id, "evidence")).payload);
    if (evidence.productKey !== input.productKey || evidence.productSnapshotId !== input.productSnapshotId) {
      throw new Error("Authoritative evidence crosses the selected product snapshot");
    }
    for (const parentId of evidence.parentEvidenceIds) await registerEvidence(parentId);
    store.registerEvidence(evidence);
    visiting.delete(id);
    registered.add(id);
  };
  const observations = [];
  for (const id of input.observationIds) {
    const observation = observationSchema.parse((await input.writer.requireSource(id, "observation")).payload);
    if (observation.productKey !== input.productKey || observation.productSnapshotId !== input.productSnapshotId) {
      throw new Error("Authoritative observation crosses the selected product snapshot");
    }
    for (const evidenceId of observation.evidenceIds) await registerEvidence(evidenceId);
    observations.push(store.recordObservation(observation));
  }
  for (const id of input.counterEvidenceIds) await registerEvidence(id);
  return Object.freeze({ store, observations });
}

/**
 * Requires previously persisted product and observation sources. Generated
 * records are committed at each validated stage before the next stage runs.
 */
export async function runAuthoritativeShadowLoop(input: {
  request: Omit<Parameters<typeof runShadowImprovementLoop>[0], "persistValidatedRecord">;
  writer: AuthoritativeLifecycleWriter;
  executionId: string;
}) {
  const { request, writer } = input;
  const productSource = await writer.requireSource(request.productContext.product.versionId, "product");
  const registered = productSource.payload as Record<string, unknown>;
  if (JSON.stringify(registered.product) !== JSON.stringify(request.productContext.product) ||
    JSON.stringify(registered.snapshot) !== JSON.stringify(request.productContext.snapshot) ||
    (["features", "capabilities", "workflows", "signals", "evaluators", "tools", "contexts"] as const)
      .some((key) => JSON.stringify(registered[key]) !== JSON.stringify(request.productContext[key]))) {
    throw new Error("Shadow loop product snapshot is not registered authoritatively");
  }
  for (const observation of request.observations) {
    const validated = observationSchema.parse(observation);
    const sourceRow = await writer.requireSource(validated.observationId, "observation");
    const source = observationSchema.parse(sourceRow.payload);
    if (source.executionId !== sourceRow.source_execution_id || source.productKey !== request.productContext.product.productKey ||
      source.productSnapshotId !== request.productContext.snapshot.productSnapshotId ||
      JSON.stringify(source) !== JSON.stringify(validated)) {
      throw new Error("Shadow loop observation does not match authoritative execution evidence");
    }
    if (JSON.stringify(request.store.requireObservation(validated.observationId)) !== JSON.stringify(source)) {
      throw new Error("Shadow loop observation store differs from authoritative source");
    }
  }
  const ids = new Set([...request.observations.flatMap((item) => item.evidenceIds), ...request.counterEvidenceIds]);
  for (const evidenceId of ids) {
    const source = observationEvidenceSchema.parse((await writer.requireSource(evidenceId, "evidence")).payload);
    if (source.productSnapshotId !== request.productContext.snapshot.productSnapshotId ||
      JSON.stringify(request.store.requireEvidence(evidenceId)) !== JSON.stringify(source)) {
      throw new Error("Shadow loop evidence store differs from authoritative source");
    }
  }
  const firstObservationId = request.observations[0]?.observationId;
  if (!firstObservationId) throw new Error("Shadow loop requires persisted observations");
  if (request.observations[0]?.executionId !== input.executionId) throw new Error("Shadow loop execution root is not its first observation");
  return runShadowImprovementLoop({ ...request,
    persistValidatedRecord: writer.shadowRecordSink({ executionId: input.executionId,
      firstObservationId, occurredAt: request.occurredAt }) });
}
