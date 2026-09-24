import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { startAuthoritativeTestCanary } from "../lib/agent-runtime/authoritative-canary";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";

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
