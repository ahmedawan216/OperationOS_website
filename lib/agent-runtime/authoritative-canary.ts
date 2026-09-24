import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
