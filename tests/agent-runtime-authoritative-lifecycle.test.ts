import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";
import { resolveProductSnapshot } from "../lib/agent-runtime/product-registry";
import { productRegistries } from "./fixtures/product-fixtures";

const at = "2026-09-24T12:00:00.000Z";
const digest = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const originalMode = process.env.CONTROL_PLANE_DATA_MODE;
const originalTenant = process.env.CONTROL_PLANE_TENANT_ID;
process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
process.env.CONTROL_PLANE_TENANT_ID = "operationos";

function database() {
  const sources = new Map<string, Record<string, unknown>>();
  const projections: Record<string, unknown>[] = [];
  const client = { from(table: string) {
    let action = "select";
    let value: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    let head = false;
    const result = () => {
      if (action === "insert") {
        if (table === "agent_runtime_lifecycle_records") sources.set(value.record_id as string, value);
        else if (table === "agent_runtime_control_plane_records") projections.push(value);
        return { data: null, error: null };
      }
      if (head) return { count: 0, data: null, error: null };
      if (table === "agent_runtime_executions") return { data: { execution_id: "execution-1" }, error: null };
      if (table === "agent_runtime_trace_events") return filters.event_id === "trace-1"
        ? { data: { event_id: "trace-1", payload: { status: "failed" } }, error: null }
        : { data: null, error: { message: "not found" } };
      const source = sources.get(filters.record_id as string);
      return source ? { data: source, error: null } : { data: null, error: { message: "not found" } };
    };
    const query = {
      insert(input: Record<string, unknown>) { action = "insert"; value = input; return query; },
      select(_fields: string, options?: { head?: boolean }) { if (!_fields) throw new Error("Missing fields"); head = !!options?.head; return query; },
      eq(field: string, input: unknown) { filters[field] = input; return query; },
      single() { return Promise.resolve(result()); },
      then(resolve: (value: unknown) => void) { resolve(result()); },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { client, sources, projections };
}

function context() {
  return resolveProductSnapshot({ productSnapshotId: "snapshot-v1", createdAt: at,
    registries: productRegistries(), manifest: {
      productVersionId: "operations-suite-product-v1", featureVersionIds: ["onboarding-feature-v1"],
      capabilityVersionIds: ["onboarding-record-read-capability-v1"], workflowVersionIds: ["onboarding-workflow-v1"],
      toolVersionIds: ["onboarding-record-read-tool-v1"], signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
      evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"],
    } });
}

test("registered product and observed trace produce sanitized source-derived Control Panel projections", async () => {
  const db = database();
  const writer = new AuthoritativeLifecycleWriter("operationos", "operations-suite", db.client);
  const product = context();
  const productRecord = { product: product.product, snapshot: product.snapshot, features: product.features,
    capabilities: product.capabilities, workflows: product.workflows, signals: product.signals,
    evaluators: product.evaluators, tools: product.tools, contexts: product.contexts };
  await writer.append({ kind: "product", recordId: product.product.versionId, payload: productRecord, occurredAt: at });
  await writer.project({ sourceId: product.product.versionId, sourceKind: "product", occurredAt: at });
  assert.equal((db.projections[0]?.payload as { snapshotId: string }).snapshotId, "snapshot-v1");
  assert.deepEqual((db.projections[0]?.payload as { capabilityKeys: string[] }).capabilityKeys, ["onboarding.record.read"]);
  const evidence = {
    contractVersion: "observation-evidence-v1", evidenceId: "evidence-1", sourceType: "execution_trace",
    sourceId: "trace-1", productKey: "operations-suite", productVersionId: product.product.versionId,
    productSnapshotId: product.snapshot.productSnapshotId, executionId: "execution-1", observedAt: at,
    digest: digest({ status: "failed" }), sensitivity: "internal", parentEvidenceIds: [],
  };
  await writer.append({ kind: "evidence", recordId: evidence.evidenceId, payload: evidence,
    parentRecordId: product.product.versionId, executionId: "execution-1", occurredAt: at });
  const observation = {
    contractVersion: "observation-v1", observationId: "observation-1", productKey: "operations-suite",
    productVersionId: product.product.versionId, productSnapshotId: product.snapshot.productSnapshotId,
    executionId: "execution-1", subject: { subjectType: "execution", subjectKey: "internal_workflow" },
    observedAt: at, window: { startedAt: at, endedAt: at }, evidenceIds: [evidence.evidenceId],
    signal: { kind: "failure", signalKey: "verification_failed", summary: "One bounded verification failed.",
      errorCode: "verification_failed", retryable: false, count: 1 }, decisionSummary: "Evidence recorded for review.",
  };
  await writer.append({ kind: "observation", recordId: observation.observationId, payload: observation,
    parentRecordId: evidence.evidenceId, executionId: "execution-1", occurredAt: at });
  await writer.project({ sourceId: observation.observationId, sourceKind: "observation", occurredAt: at });
  assert.deepEqual((db.projections[1]?.payload as { evidenceIds: string[] }).evidenceIds, ["evidence-1"]);
  assert.equal(db.projections[1]?.source_digest, db.sources.get("observation-1")?.source_digest);
  await assert.rejects(writer.append({ kind: "observation", recordId: "fabricated", payload: observation,
    parentRecordId: evidence.evidenceId, executionId: "execution-1", occurredAt: at }));
  await assert.rejects(writer.append({ kind: "observation", recordId: observation.observationId,
    payload: { ...observation, evidenceIds: ["fabricated"] }, parentRecordId: evidence.evidenceId,
    executionId: "execution-1", occurredAt: at }));
  await assert.rejects(writer.append({ kind: "observation", recordId: observation.observationId,
    payload: { ...observation, productSnapshotId: "unrelated-snapshot" }, parentRecordId: evidence.evidenceId,
    executionId: "execution-1", occurredAt: at }));
  await assert.rejects(writer.append({ kind: "evidence", recordId: "different-evidence",
    payload: { ...evidence, evidenceId: "different-evidence", digest: digest({ fabricated: true }) },
    parentRecordId: product.product.versionId, executionId: "execution-1", occurredAt: at }));
  await assert.rejects(writer.append({ kind: "evidence", recordId: "cross-product-evidence",
    payload: { ...evidence, evidenceId: "cross-product-evidence", productKey: "unrelated" },
    parentRecordId: product.product.versionId, executionId: "execution-1", occurredAt: at }));
  await assert.rejects(writer.project({ sourceId: "fabricated", sourceKind: "candidate", occurredAt: at }));
  await assert.rejects(writer.append({ kind: "risk_decision", recordId: "risk:fake:fake",
    parentRecordId: "fake", executionId: "execution-1", occurredAt: at,
    payload: { contractVersion: "risk-gate-decision-v1", candidateId: "fake",
      decision: "canary_eligible", reason: "Caller tried to self-authorize", active: false } }));
  await assert.rejects(writer.append({ kind: "canary", recordId: "fake",
    parentRecordId: "fake", executionId: "execution-1", occurredAt: at, payload: {} }));
});

test("migration enforces immutable source, tenant/product foreign keys and service-only projection access", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924120000_agent_runtime_lifecycle_sources.sql", import.meta.url), "utf8");
  assert.match(sql, /agent_runtime_lifecycle_records_append_only/);
  assert.match(sql, /foreign key \(tenant_id, product_key, source_record_id, source_digest\)/);
  assert.match(sql, /revoke all on table public\.agent_runtime_lifecycle_records from public, anon, authenticated/);
  assert.match(sql, /grant select, insert on table public\.agent_runtime_lifecycle_records to service_role/);
});

test("human approval consumption is scoped, exact-bound, single-use and service-only", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260924130000_agent_runtime_consume_approval.sql", import.meta.url), "utf8");
  for (const binding of ["tenant_id", "product_key", "execution_id", "candidate_id", "approval_id",
    "actor_id", "action_digest"]) assert.match(sql, new RegExp(`approval\\.${binding} = p_${binding}`));
  assert.match(sql, /approval\.status = 'approved'/);
  assert.match(sql, /approval\.expires_at > p_consumed_at/);
  assert.match(sql, /approval\.action_type = 'start_canary'/);
  assert.match(sql, /approval\.resolved_by = p_actor_id/);
  assert.match(sql, /revoke all on function public\.agent_runtime_consume_approval.*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.agent_runtime_consume_approval.*to service_role/);
});

test("caller cannot append an approval-backed risk result or forged deployment record", async () => {
  const writer = new AuthoritativeLifecycleWriter("operationos", "operations-suite", database().client);
  await assert.rejects(writer.append({ kind: "risk_decision", recordId: "risk:candidate-1:comparison-1:approval-1",
    executionId: "execution-1", parentRecordId: "comparison-1", occurredAt: at,
    payload: { contractVersion: "risk-gate-decision-v1", candidateId: "candidate-1", decision: "canary_eligible",
      approvalConsumedId: "approval-1", reason: "forged", active: false } }), /authoritative engines/);
  await assert.rejects(writer.requestRiskApproval({ executionId: "execution-1", candidateId: "candidate-1",
    comparisonId: "comparison-1", approvalId: "approval-1", actorId: "founder", requestedBy: "runtime",
    expiresAt: "2026-09-25T00:00:00.000Z", occurredAt: at }), /source lookup/);
});

test.after(() => {
  if (originalMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
  else process.env.CONTROL_PLANE_DATA_MODE = originalMode;
  if (originalTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
  else process.env.CONTROL_PLANE_TENANT_ID = originalTenant;
});
