import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { startAuthoritativeTestCanary } from "../lib/agent-runtime/authoritative-canary";
import { deriveCanaryScopeSignal, finishAuthoritativeTestCanary } from "../lib/agent-runtime/authoritative-canary";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";

test("canary refuses an unrecorded Risk Gate decision before querying deployment pointers", async () => {
  const oldMode = process.env.CONTROL_PLANE_DATA_MODE;
  const oldTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  let queryReached = false;
  try {
    const writer = { async requireSource() { throw new Error("Risk Gate source absent"); } } as unknown as AuthoritativeLifecycleWriter;
    const client = { from() { queryReached = true; throw new Error("Unexpected deployment read"); } };
    await assert.rejects(() => startAuthoritativeTestCanary({ tenantId: "operationos", productKey: "operationos",
      executionId: "execution", riskRecordId: "risk:unknown", config: { target: "test" }, writer,
      client: client as never }), /invalid|Required|too_small/i);
    assert.equal(queryReached, false);
    await assert.rejects(() => startAuthoritativeTestCanary({ tenantId: "other", productKey: "operationos",
      executionId: "execution", riskRecordId: "risk:unknown", config: {}, writer,
      client: client as never }), /tenant is not configured/);
  } finally {
    if (oldMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = oldMode;
    if (oldTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = oldTenant;
  }
});

test("non-production canary database transition is atomic, source bound and inaccessible to public roles", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924140000_agent_runtime_start_nonproduction_canary.sql", import.meta.url), "utf8");
  for (const table of ["agent_runtime_lifecycle_records", "agent_runtime_control_plane_records", "agent_runtime_deployments"]) {
    assert.match(sql, new RegExp(`insert into public\\.${table}`));
  }
  assert.match(sql, /p_config ->> 'target' not in \('test', 'preview'\)/);
  assert.match(sql, /risk_record\.payload ->> 'candidateId'/);
  assert.match(sql, /a\.status = 'consumed'/);
  assert.match(sql, /good\.manifest ->> 'digest'/);
  assert.match(sql, /revoke all on function public\.agent_runtime_start_nonproduction_canary.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.agent_runtime_start_nonproduction_canary.*to service_role/);
  assert.doesNotMatch(sql, /'production',\s*'canary'/);
});

test("terminal canary outcome must match persisted same-product signals and frozen thresholds", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924150000_agent_runtime_finish_nonproduction_canary.sql", import.meta.url), "utf8");
  assert.match(sql, /agent_runtime_lifecycle_records[\s\S]*canary_monitor/);
  assert.match(sql, /e\.product_key = p_product_key/);
  assert.match(sql, /s\.signal_id = p_result -> 'signalIds'/);
  assert.match(sql, /s\.metric_key = metric\.metric_key/);
  assert.match(sql, /s\.source in \('runtime', 'deterministic_evaluator'\)/);
  assert.match(sql, /source\.payload -> 'thresholds'/);
  assert.match(sql, /p_result ->> 'state' <> 'rolled_back'/);
  assert.match(sql, /p_result ->> 'state' <> 'promotion_eligible'/);
  assert.match(sql, /exists \(\s*select 1 from public\.agent_runtime_lifecycle_records/);
  assert.match(sql, /insert into public\.agent_runtime_control_plane_records/);
  assert.match(sql, /revoke all on function public\.agent_runtime_finish_nonproduction_canary.*from public, anon, authenticated/);
});

test("persisted rerun measurements determine rollback or keep eligibility; missing signal blocks checkpoint", async () => {
  const oldMode = process.env.CONTROL_PLANE_DATA_MODE;
  const oldTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  const digest = `sha256:${"a".repeat(64)}`;
  const at = "2026-09-24T12:00:00.000Z";
  const config = { canaryId: "canary", candidateVersionId: "candidate", knownGoodVersionId: "base",
    rollbackVersionId: "base", target: "test", allocationPercent: 5, maxDurationMs: 60_000,
    thresholds: { maxFailureRate: 0.1, maxSafetyViolations: 0, maxLatencyMs: 100, maxCostUsd: 1 },
    conditionsDigest: digest, createdAt: at };
  const writer = { async requireSource(id: string) {
    if (id === "canary") return { payload: config, source_execution_id: "root" };
    if (id === "candidate") return { source_digest: digest };
    throw new Error("Missing source");
  } } as unknown as AuthoritativeLifecycleWriter;
  const signalIds = { successSignalId: "success", safetySignalId: "safety", latencySignalId: "latency",
    costSignalId: "cost" };
  const metrics = { success: 0, safety: 0, latency: 30, cost: 0.2 };
  const recorded: unknown[] = [];
  const fake = { from(table: string) {
    const filters: Record<string, string> = {};
    const query = { select() { return query; }, eq(key: string, value: string) { filters[key] = value; return query; },
      async single() {
        if (table === "agent_runtime_executions") return { data: { execution_id: "rerun", status: "succeeded" }, error: null };
        if (table === "agent_runtime_deployments") return { data: filters.deployment_id === "base"
          ? { deployment_id: "base", manifest: { digest }, created_at: at }
          : { deployment_id: "candidate", manifest: { digest }, created_at: at }, error: null };
        const signalId = filters.signal_id as keyof typeof metrics;
        if (!(signalId in metrics)) return { data: null, error: { message: "absent" } };
        return { data: { source: "runtime", metric_value: metrics[signalId] }, error: null };
      } };
    return query;
  }, async rpc(_name: string, args: Record<string, unknown>) {
    recorded.push(args);
    return { data: [{ event_id: args.p_event_id, state: (args.p_result as { state: string }).state }], error: null };
  } } as unknown as SupabaseClient;
  const run = () => finishAuthoritativeTestCanary({ tenantId: "operationos", productKey: "operationos",
    canaryId: "canary", executionId: "root", rerunExecutionId: "rerun", eventId: "event-1",
    signalIds, at: "2026-09-24T12:00:30.000Z", writer, client: fake });
  try {
    const failed = await run();
    assert.equal(failed.snapshot.state, "rolled_back");
    assert.equal(failed.snapshot.events.at(-1)?.to, "base");
    assert.equal(failed.projection.productionActivationAllowed, false);
    metrics.success = 1;
    const healthy = await run();
    assert.equal(healthy.snapshot.state, "promotion_eligible");
    assert.equal(healthy.snapshot.knownGoodVersionId, "base");
    assert.equal(recorded.length, 2);
    delete (metrics as Partial<typeof metrics>).safety;
    await assert.rejects(run, /authoritative outcome signal/);
    assert.equal(recorded.length, 2);
  } finally {
    if (oldMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = oldMode;
    if (oldTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = oldTenant;
  }
});

test("safety scope count is derived from immutable runtime denial traces", async () => {
  const oldMode = process.env.CONTROL_PLANE_DATA_MODE;
  const oldTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  const inserts: unknown[] = [];
  const client = { from(table: string) {
    const filters: Record<string, string> = {};
    const query = { select() { return query; }, eq(key: string, value: string) { filters[key] = value; return query; },
      single: async () => ({ data: filters.product_key === "operationos" ? { execution_id: "rerun", status: "succeeded" } : null,
        error: filters.product_key === "operationos" ? null : { message: "scope denied" } }),
      insert: async (value: unknown) => { inserts.push(value); return { error: null }; },
      then(resolve: (value: unknown) => void) { resolve({ count: table === "agent_runtime_trace_events" ? 2 : 0, error: null }); },
    };
    return query;
  } } as unknown as SupabaseClient;
  try {
    const signal = await deriveCanaryScopeSignal({ tenantId: "operationos", productKey: "operationos",
      rerunExecutionId: "rerun", signalId: "scope-1", recordedAt: "2026-09-24T12:00:00.000Z", client });
    assert.equal(signal.value, 2);
    assert.equal((inserts[0] as { metric_value: number }).metric_value, 2);
    await assert.rejects(() => deriveCanaryScopeSignal({ tenantId: "operationos", productKey: "other",
      rerunExecutionId: "rerun", signalId: "scope-2", recordedAt: "2026-09-24T12:00:00.000Z", client }), /same-product/);
    assert.equal(inserts.length, 1);
  } finally {
    if (oldMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = oldMode;
    if (oldTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = oldTenant;
  }
});
