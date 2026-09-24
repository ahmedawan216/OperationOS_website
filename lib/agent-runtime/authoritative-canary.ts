import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { canarySummarySchema } from "../control-plane/contracts";
import { getServerSupabaseClient } from "../supabase/server-client";
import { DeploymentController, canaryConfigSchema } from "./deployment-controller";
import { shadowCandidateSchema } from "./optimizer-contracts";
import { riskGateDecisionSchema } from "./risk-gate";
import { canaryActionDigest } from "./risk-gate";
import { comparisonSchema } from "./comparison-engine";
import { evaluationRunSchema } from "./evaluation-engine";
import { evaluationPlanSchema } from "./evaluation-contracts";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";
import { SupabaseAgentRuntimePersistence } from "./supabase-persistence";

/** The domain controller validates this transition, and the database commits
 * the source, projection and non-production deployment atomically. */
export async function startAuthoritativeTestCanary(input: {
  tenantId: string; productKey: string; executionId: string;
  riskRecordId: string; config: unknown; writer: AuthoritativeLifecycleWriter;
  client?: SupabaseClient;
}) {
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" ||
    input.tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim()) {
    throw new Error("Authoritative canary tenant is not configured");
  }
  const config = canaryConfigSchema.parse(input.config);
  const riskSource = await input.writer.requireSource(input.riskRecordId, "risk_decision");
  const decision = riskGateDecisionSchema.parse(riskSource.payload);
  const candidate = shadowCandidateSchema.parse((await input.writer.requireSource(decision.candidateId, "candidate")).payload);
  const comparison = comparisonSchema.parse((await input.writer.requireSource(riskSource.parent_record_id!, "comparison")).payload);
  const run = evaluationRunSchema.parse((await input.writer.requireSource(comparison.runId, "evaluation_run")).payload);
  const plan = evaluationPlanSchema.parse((await input.writer.requireSource(run.planId, "evaluation_plan")).payload);
  if (riskSource.source_execution_id !== input.executionId ||
    input.riskRecordId !== `risk:${candidate.candidateId}:${riskSource.parent_record_id}${decision.approvalConsumedId ? `:${decision.approvalConsumedId}` : ""}` ||
    candidate.productKey !== input.productKey || decision.decision !== "canary_eligible" ||
    config.candidateVersionId !== candidate.candidateId ||
    config.knownGoodVersionId !== candidate.baseline.baselineVersionId ||
    config.rollbackVersionId !== config.knownGoodVersionId ||
    config.conditionsDigest !== plan.conditionsDigest || plan.candidateId !== candidate.candidateId ||
    decision.authorizedActionDigest !== canaryActionDigest({ candidate, plan, comparison,
      deploymentTarget: config.target })) {
    throw new Error("Canary cannot cross the approved candidate, execution or known-good version");
  }
  const client = input.client ?? getServerSupabaseClient();
  const { data: good, error } = await client.from("agent_runtime_deployments")
    .select("deployment_id,environment,status,manifest,created_at")
    .eq("tenant_id", input.tenantId).eq("product_key", input.productKey)
    .eq("deployment_id", config.knownGoodVersionId).eq("status", "active")
    .eq("environment", config.target).single();
  if (error || !good || good.manifest?.digest !== candidate.baseline.baselineDigest) {
    throw new Error("Exact immutable non-production known-good version is unavailable");
  }
  const controller = new DeploymentController();
  controller.registerVersion({ versionId: good.deployment_id, digest: good.manifest.digest,
    status: "known_good", createdAt: good.created_at });
  const candidateSource = await input.writer.requireSource(candidate.candidateId, "candidate");
  controller.registerVersion({ versionId: candidate.candidateId, digest: candidateSource.source_digest,
    status: "candidate", createdAt: candidate.createdAt });
  const snapshot = controller.startCanary({ decision, config, at: config.createdAt });
  const projection = canarySummarySchema.parse({ productKey: input.productKey, canaryId: config.canaryId,
    state: snapshot.state, candidateVersionId: config.candidateVersionId,
    knownGoodVersionId: config.knownGoodVersionId, rollbackVersionId: config.rollbackVersionId,
    conditionsDigest: config.conditionsDigest, target: config.target,
    allocationPercent: config.allocationPercent, productionActivationAllowed: false,
    eventSummaries: snapshot.events.map((event) => event.reason) });
  const sourceDigest = `sha256:${createHash("sha256").update(JSON.stringify(config)).digest("hex")}`;
  const started = await client.rpc("agent_runtime_start_nonproduction_canary", {
    p_tenant_id: input.tenantId, p_product_key: input.productKey, p_execution_id: input.executionId,
    p_risk_record_id: input.riskRecordId, p_config: config, p_source_digest: sourceDigest,
    p_projection: projection, p_started_at: config.createdAt,
  });
  if (started.error || !Array.isArray(started.data) || started.data.length !== 1 ||
    started.data[0].canary_id !== config.canaryId || started.data[0].state !== "canary") {
    throw new Error("Authoritative non-production canary transition failed");
  }
  return Object.freeze({ config, snapshot, projection });
}

const signalIdsSchema = z.object({
  successSignalId: z.string().min(1), safetySignalId: z.string().min(1),
  latencySignalId: z.string().min(1), costSignalId: z.string().min(1),
}).strict();

/** Derives the existing scope_violation metric from the runtime's immutable
 * policy denial trace, after verifying the rerun belongs to this product.
 * No caller-provided safety number or provider claim is accepted. */
export async function deriveCanaryScopeSignal(input: {
  tenantId: string; productKey: string; rerunExecutionId: string;
  signalId: string; recordedAt: string; client?: SupabaseClient;
}) {
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" ||
    input.tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim()) {
    throw new Error("Authoritative canary tenant is not configured");
  }
  const client = input.client ?? getServerSupabaseClient();
  const { data: execution, error: executionError } = await client.from("agent_runtime_executions")
    .select("execution_id,status").eq("tenant_id", input.tenantId)
    .eq("product_key", input.productKey).eq("execution_id", input.rerunExecutionId).single();
  if (executionError || !execution || !["succeeded", "failed"].includes(execution.status)) {
    throw new Error("Scope signal requires a terminal same-product execution");
  }
  const { count, error } = await client.from("agent_runtime_trace_events")
    .select("event_id", { count: "exact", head: true })
    .eq("tenant_id", input.tenantId).eq("execution_id", input.rerunExecutionId)
    .eq("event_type", "tool.denied");
  if (error || count === null) throw new Error("Policy denial trace count is unavailable");
  await new SupabaseAgentRuntimePersistence(input.tenantId, input.productKey, client).appendOutcome({
    signalId: input.signalId, executionId: input.rerunExecutionId, metricKey: "scope_violation",
    value: count, unit: "count", source: "runtime", recordedAt: input.recordedAt,
  });
  return Object.freeze({ signalId: input.signalId, value: count });
}

/** A terminal outcome must be measured by persisted signals from another
 * same-product execution. The database independently checks all six readings
 * and frozen thresholds in the same transaction as the terminal checkpoint. */
export async function finishAuthoritativeTestCanary(input: {
  tenantId: string; productKey: string; canaryId: string; executionId: string;
  rerunExecutionId: string; eventId: string; signalIds: unknown;
  at: string; writer: AuthoritativeLifecycleWriter; client?: SupabaseClient;
}) {
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" ||
    input.tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim() ||
    input.executionId === input.rerunExecutionId) {
    throw new Error("Authoritative canary tenant or rerun is invalid");
  }
  const signalIds = signalIdsSchema.parse(input.signalIds);
  if (new Set(Object.values(signalIds)).size !== 4) throw new Error("Canary measurement signals must be distinct");
  const started = await input.writer.requireSource(input.canaryId, "canary");
  const config = canaryConfigSchema.parse(started.payload);
  if (started.source_execution_id !== input.executionId ||
    config.target === undefined || input.eventId === input.canaryId ||
    Date.parse(input.at) < Date.parse(config.createdAt)) {
    throw new Error("Canary configuration, execution or frozen duration is invalid");
  }
  const client = input.client ?? getServerSupabaseClient();
  const { data: rerun, error: rerunError } = await client.from("agent_runtime_executions")
    .select("execution_id,status").eq("tenant_id", input.tenantId)
    .eq("product_key", input.productKey).eq("execution_id", input.rerunExecutionId).single();
  if (rerunError || !rerun || !["succeeded", "failed"].includes(rerun.status)) {
    throw new Error("Canary rerun must be a terminal same-product execution");
  }
  const { data: good, error } = await client.from("agent_runtime_deployments")
    .select("deployment_id,environment,status,manifest,created_at")
    .eq("tenant_id", input.tenantId).eq("product_key", input.productKey)
    .eq("deployment_id", config.knownGoodVersionId).eq("status", "active")
    .eq("environment", config.target).single();
  if (error || !good) throw new Error("Known-good rollback version is unavailable");
  const { data: candidate, error: candidateError } = await client.from("agent_runtime_deployments")
    .select("deployment_id,environment,status,manifest,created_at")
    .eq("tenant_id", input.tenantId).eq("product_key", input.productKey)
    .eq("deployment_id", config.candidateVersionId).eq("status", "canary")
    .eq("environment", config.target).single();
  if (candidateError || !candidate || candidate.manifest?.digest !==
    (await input.writer.requireSource(config.candidateVersionId, "candidate")).source_digest) {
    throw new Error("Bounded non-production canary pointer is unavailable");
  }
  const definitions = [
    ["successSignalId", "goal_success"], ["safetySignalId", "scope_violation"],
    ["latencySignalId", "latency_ms"], ["costSignalId", "cost_usd"],
  ] as const;
  const readings = new Map<string, number>();
  for (const [field, metricKey] of definitions) {
    const { data, error: signalError } = await client.from("agent_runtime_outcome_signals")
      .select("signal_id,metric_key,metric_value,source")
      .eq("tenant_id", input.tenantId).eq("execution_id", input.rerunExecutionId)
      .eq("signal_id", signalIds[field]).eq("metric_key", metricKey).single();
    if (signalError || !data || !["runtime", "deterministic_evaluator"].includes(data.source) ||
      !Number.isFinite(data.metric_value)) throw new Error("Canary measurement has no authoritative outcome signal");
    readings.set(field, data.metric_value);
  }
  if (![0, 1].includes(readings.get("successSignalId")!) ||
    !Number.isInteger(readings.get("safetySignalId")!) || readings.get("safetySignalId")! < 0) {
    throw new Error("Canary success and safety signals must be valid runtime measurements");
  }
  const controller = new DeploymentController();
  controller.registerVersion({ versionId: good.deployment_id, digest: good.manifest.digest,
    status: "known_good", createdAt: good.created_at });
  controller.registerVersion({ versionId: candidate.deployment_id, digest: candidate.manifest.digest,
    status: "candidate", createdAt: candidate.created_at });
  controller.startCanary({ decision: { contractVersion: "risk-gate-decision-v1", candidateId: config.candidateVersionId,
    decision: "canary_eligible", reason: "Replaying the persisted authorized start", active: false },
    config, at: config.createdAt });
  const measurements = {
    failureRate: 1 - readings.get("successSignalId")!, safetyViolations: readings.get("safetySignalId")!,
    latencyMs: readings.get("latencySignalId")!, costUsd: readings.get("costSignalId")!,
    integrityValid: readings.get("safetySignalId") === 0 &&
      Date.parse(input.at) <= Date.parse(config.createdAt) + config.maxDurationMs,
    windowComplete: true,
  };
  const snapshot = controller.monitor({ config, ...measurements, at: input.at });
  if (snapshot.state !== "rolled_back" && snapshot.state !== "promotion_eligible") {
    throw new Error("Canary monitoring has not reached a terminal outcome");
  }
  const result = { contractVersion: "canary-monitor-v1", canaryId: config.canaryId,
    rerunExecutionId: input.rerunExecutionId, signalIds, ...measurements,
    state: snapshot.state, completedAt: input.at };
  const projection = canarySummarySchema.parse({ productKey: input.productKey, canaryId: config.canaryId,
    state: snapshot.state, candidateVersionId: config.candidateVersionId,
    knownGoodVersionId: config.knownGoodVersionId, rollbackVersionId: config.rollbackVersionId,
    conditionsDigest: config.conditionsDigest, target: config.target,
    allocationPercent: config.allocationPercent, productionActivationAllowed: false,
    eventSummaries: snapshot.events.map((event) => event.reason) });
  const sourceDigest = `sha256:${createHash("sha256").update(JSON.stringify(result)).digest("hex")}`;
  const saved = await client.rpc("agent_runtime_finish_nonproduction_canary", {
    p_tenant_id: input.tenantId, p_product_key: input.productKey,
    p_canary_id: config.canaryId, p_event_id: input.eventId,
    p_result: result, p_source_digest: sourceDigest,
    p_projection: projection, p_completed_at: input.at,
  });
  if (saved.error || !Array.isArray(saved.data) || saved.data.length !== 1 ||
    saved.data[0].event_id !== input.eventId || saved.data[0].state !== snapshot.state) {
    throw new Error("Authoritative canary terminal checkpoint failed");
  }
  return Object.freeze({ result, projection, snapshot });
}
