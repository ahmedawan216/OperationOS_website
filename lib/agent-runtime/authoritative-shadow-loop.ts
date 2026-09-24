import "server-only";

import { observationEvidenceSchema, observationSchema } from "./observation-contracts";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";
import { runShadowImprovementLoop } from "./shadow-loop";

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
