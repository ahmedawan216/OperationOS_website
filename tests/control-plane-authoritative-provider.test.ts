import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { AuthoritativeControlPlaneProvider, type AuthoritativeControlPlaneRepository, type AuthoritativeControlPlaneRows } from "../lib/control-plane/authoritative-provider";
import { dayOneAgentFixtures } from "../lib/agent-runtime/fixtures";
import { readControlPlaneSnapshot } from "../lib/control-plane/provider";

const at = "2026-09-23T10:00:00.000Z";
const product = {
  productKey: "operations-suite",
  name: "Operations Suite",
  productVersionId: "product-v1",
  snapshotId: "snapshot-v1",
  featureCount: 1,
  capabilityKeys: ["workflow.model"],
  workflowKeys: ["workflow.discovery"],
  signalKeys: ["workflow.completed"],
  evaluatorKeys: ["workflow.quality.v1"],
  recentExecutionCount: 1,
};

function source(overrides: Partial<AuthoritativeControlPlaneRows> = {}): AuthoritativeControlPlaneRepository {
  const base: AuthoritativeControlPlaneRows = {
    agents: [{ definition: { ...dayOneAgentFixtures[0], status: "active" } }],
    deployments: [{ deployment_id: "manager-v1", product_key: "operations-suite", environment: "production", manifest: { version: "manager-v1" }, status: "active", created_at: at }],
    executions: [{ execution_id: "exec-1", product_key: "operations-suite", goal_id: "goal-private", status: "succeeded", created_at: at, updated_at: at, goal: { objective: "candidate@example.com private resume" } }],
    steps: [{ execution_id: "exec-1", attempt: 1, assignment: { assignedAgentKey: "manager" }, status: "succeeded" }],
    traces: [{ execution_id: "exec-1", event_type: "verification.completed", payload: { authorization: "must-not-render" } }],
    outcomes: [{ execution_id: "exec-1", metric_key: "workflow.completed" }],
    approvals: [{ approval_id: "approval-1", product_key: "operations-suite", execution_id: "exec-1", candidate_id: null, actor_id: "founder", action_type: "candidate.canary.start", risk_level: "medium", action_digest: `sha256:${"a".repeat(64)}`, expires_at: "2026-09-24T10:00:00.000Z", status: "pending", summary: "candidate@example.com" }],
    records: [{ record_id: "product-record-1", product_key: "operations-suite", record_kind: "product", schema_version: "control-plane-snapshot-v1", source_record_id: "snapshot-v1", source_digest: `sha256:${"b".repeat(64)}`, payload: product, occurred_at: at }],
  };
  return { async load() { return { ...base, ...overrides }; } };
}

test("authoritative provider projects real rows without raw goal, error, trace, or approval payloads", async () => {
  const provider = new AuthoritativeControlPlaneProvider(source(), "tenant-1", () => new Date(at));
  const snapshot = await readControlPlaneSnapshot({ provider, founderId: "founder", productKey: "operations-suite" });
  assert.equal(snapshot.sourceMode, "authoritative");
  assert.equal(snapshot.products[0]?.productKey, "operations-suite");
  assert.equal(snapshot.executions[0]?.goalSummary, "Runtime goal goal-private");
  assert.equal(snapshot.approvals[0]?.payloadSummary, "candidate.canary.start for exec-1");
  assert.equal(snapshot.versions[0]?.pointer, "known_good");
  assert.equal(/candidate@example|authorization|resume/i.test(JSON.stringify(snapshot)), false);
});

test("authoritative records fail closed on malformed or cross-product projections", async () => {
  const crossProduct = { ...product, productKey: "other-product" };
  const records = [{ record_id: "bad", product_key: "operations-suite", record_kind: "product", schema_version: "control-plane-snapshot-v1", source_record_id: "snapshot-v1", source_digest: `sha256:${"c".repeat(64)}`, payload: crossProduct, occurred_at: at }];
  const provider = new AuthoritativeControlPlaneProvider(source({ records }), "tenant-1", () => new Date(at));
  await assert.rejects(() => readControlPlaneSnapshot({ provider, founderId: "founder", productKey: "operations-suite" }), /crosses product context/);
});

test("production migration keeps Control Plane records immutable and server-only", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923090000_control_plane_authoritative_records.sql", import.meta.url), "utf8");
  assert.match(sql, /agent_runtime_control_plane_records_append_only/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table public\.agent_runtime_control_plane_records from public, anon, authenticated/);
  assert.match(sql, /grant select, insert on table public\.agent_runtime_control_plane_records to service_role/);
  assert.doesNotMatch(sql, /grant .* to anon|grant .* to authenticated/i);
});
