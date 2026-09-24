import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "../supabase/server-client";
import { observationEvidenceSchema, observationSchema } from "./observation-contracts";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";

/** Normalizes an actual runtime goal outcome, without inferring why it failed.
 * The writer independently verifies the source signal, its digest, and scope. */
export async function observeAuthoritativeGoal(input: {
  writer: AuthoritativeLifecycleWriter; tenantId: string; productKey: string;
  productVersionId: string; productSnapshotId: string; executionId: string;
  goalSignalId: string; capabilityKey: string;
  evidenceId: string; observationId: string; observedAt: string;
  client?: SupabaseClient;
}) {
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" ||
    input.tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim()) {
    throw new Error("Authoritative observation tenant is not configured");
  }
  const registered = await input.writer.requireSource(input.productVersionId, "product");
  const product = registered.payload as { product?: { productKey?: string }; snapshot?: { productSnapshotId?: string };
    capabilities?: { capabilityKey: string }[] };
  if (product.product?.productKey !== input.productKey ||
    product.snapshot?.productSnapshotId !== input.productSnapshotId ||
    !product.capabilities?.some((item) => item.capabilityKey === input.capabilityKey)) {
    throw new Error("Observation capability is not in the registered product snapshot");
  }
  const client = input.client ?? getServerSupabaseClient();
  const { data: execution, error: executionError } = await client.from("agent_runtime_executions")
    .select("execution_id,status,created_at").eq("tenant_id", input.tenantId)
    .eq("product_key", input.productKey).eq("execution_id", input.executionId).single();
  if (executionError || !execution || !["succeeded", "failed"].includes(execution.status)) {
    throw new Error("Observation requires a terminal same-product execution");
  }
  const { data: signal, error } = await client.from("agent_runtime_outcome_signals")
    .select("signal_id,metric_key,metric_value,source").eq("tenant_id", input.tenantId)
    .eq("execution_id", input.executionId).eq("signal_id", input.goalSignalId)
    .eq("metric_key", "goal_success").single();
  if (error || !signal || signal.source !== "deterministic_evaluator" ||
    ![0, 1].includes(signal.metric_value) ||
    (execution.status === "succeeded") !== (signal.metric_value === 1)) {
    throw new Error("Goal outcome does not match the runtime's terminal verification");
  }
  const digest = `sha256:${createHash("sha256").update(JSON.stringify({ metric_key: "goal_success",
    metric_value: signal.metric_value })).digest("hex")}`;
  const evidence = observationEvidenceSchema.parse({ contractVersion: "observation-evidence-v1",
    evidenceId: input.evidenceId, sourceType: "outcome_signal", sourceId: signal.signal_id,
    productKey: input.productKey, productVersionId: input.productVersionId,
    productSnapshotId: input.productSnapshotId, executionId: input.executionId,
    observedAt: input.observedAt, digest, sensitivity: "internal", parentEvidenceIds: [] });
  await input.writer.append({ kind: "evidence", recordId: evidence.evidenceId,
    parentRecordId: input.productVersionId, executionId: input.executionId,
    payload: evidence, occurredAt: input.observedAt });
  const failed = signal.metric_value === 0;
  const observation = observationSchema.parse({ contractVersion: "observation-v1",
    observationId: input.observationId, productKey: input.productKey,
    productVersionId: input.productVersionId, productSnapshotId: input.productSnapshotId,
    executionId: input.executionId, subject: { subjectType: "capability", subjectKey: input.capabilityKey },
    observedAt: input.observedAt, window: { startedAt: execution.created_at, endedAt: input.observedAt },
    evidenceIds: [evidence.evidenceId], signal: failed
      ? { kind: "failure", signalKey: "goal_success", summary: "Runtime goal was not verified as successful.",
        errorCode: "goal_unsuccessful", retryable: false, count: 1 }
      : { kind: "outcome", signalKey: "goal_success", summary: "Runtime goal was verified as successful.",
        value: true, unit: "boolean" },
    decisionSummary: "Recorded the runtime outcome without inferring cause." });
  await input.writer.append({ kind: "observation", recordId: observation.observationId,
    parentRecordId: evidence.evidenceId, executionId: input.executionId,
    payload: observation, occurredAt: input.observedAt });
  await input.writer.project({ sourceId: observation.observationId,
    sourceKind: "observation", occurredAt: input.observedAt });
  return Object.freeze({ evidence, observation });
}
