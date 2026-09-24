import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { observeAuthoritativeGoal } from "../lib/agent-runtime/authoritative-observation";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";

test("runtime verified outcome becomes evidence and observation only after authoritative source checks", async () => {
  const oldMode = process.env.CONTROL_PLANE_DATA_MODE;
  const oldTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  let status = "failed";
  let metric = 0;
  const writes: Array<{ kind?: string; payload?: { digest?: string } }> = [];
  const writer = { async requireSource() { return { payload: { product: { productKey: "operationos" },
    snapshot: { productSnapshotId: "snapshot" }, capabilities: [{ capabilityKey: "workflow.discovery" }] } }; },
  async append(value: { kind: string; payload: { digest?: string } }) { writes.push(value); },
  async project() { writes.push({ kind: "projection" }); } } as unknown as AuthoritativeLifecycleWriter;
  const client = { from(table: string) {
    const q = { select() { return q; }, eq() { return q; },
      async single() { return { data: table === "agent_runtime_executions"
        ? { execution_id: "execution", status, created_at: "2026-09-24T12:00:00.000Z" }
        : { signal_id: "signal", metric_key: "goal_success", metric_value: metric,
          source: "deterministic_evaluator" }, error: null }; } };
    return q;
  } } as unknown as SupabaseClient;
  const input = { writer, client, tenantId: "operationos", productKey: "operationos",
    productVersionId: "product-v1", productSnapshotId: "snapshot", executionId: "execution",
    goalSignalId: "signal", capabilityKey: "workflow.discovery", evidenceId: "evidence",
    observationId: "observation", observedAt: "2026-09-24T12:01:00.000Z" };
  try {
    const failed = await observeAuthoritativeGoal(input);
    assert.equal(failed.observation.signal.kind, "failure");
    assert.deepEqual(writes.map((entry) => entry.kind), ["evidence", "observation", "projection"]);
    assert.match(writes[0]?.payload?.digest ?? "", /^sha256:[0-9a-f]{64}$/);
    status = "succeeded";
    metric = 1;
    const success = await observeAuthoritativeGoal({ ...input, evidenceId: "evidence-2", observationId: "observation-2" });
    assert.equal(success.observation.signal.kind, "outcome");
    metric = 0;
    await assert.rejects(() => observeAuthoritativeGoal(input), /does not match/);
    assert.equal(writes.length, 6);
    await assert.rejects(() => observeAuthoritativeGoal({ ...input, capabilityKey: "invented" }), /not in the registered/);
  } finally {
    if (oldMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = oldMode;
    if (oldTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = oldTenant;
  }
});
