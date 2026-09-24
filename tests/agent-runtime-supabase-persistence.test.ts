import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAgentRuntimePersistence } from "../lib/agent-runtime/supabase-persistence";

const now = "2026-09-24T12:00:00.000Z";
const originalMode = process.env.CONTROL_PLANE_DATA_MODE;
const originalTenant = process.env.CONTROL_PLANE_TENANT_ID;
process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
process.env.CONTROL_PLANE_TENANT_ID = "operationos";

function database(input: { fail?: boolean; product?: string } = {}) {
  const calls: Array<{ table: string; action: string; value: unknown; filters: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      const entry = { table, action: "select", value: undefined as unknown, filters: {} as Record<string, unknown> };
      calls.push(entry);
      const query = {
        insert(value: unknown) { entry.action = "insert"; entry.value = value; return query; },
        update(value: unknown) { entry.action = "update"; entry.value = value; return query; },
        select(fields: string) { if (!fields) throw new Error("Selection must declare columns"); return query; },
        eq(key: string, value: unknown) { entry.filters[key] = value; return query; },
        single() { return Promise.resolve(result()); },
        then(resolve: (value: unknown) => void) { resolve(result()); },
      };
      function result() {
        if (input.fail) return { data: null, error: { message: "private database detail", code: "XX000" } };
        if (entry.action === "insert") return { data: { execution_id: "execution-proof" }, error: null };
        if (entry.action === "update") return { data: { execution_id: "execution-proof", step_attempt_id: "attempt-1" }, error: null };
        if (table === "agent_runtime_executions") return {
          data: input.product === "unrelated" ? null : { execution_id: "execution-proof" },
          error: input.product === "unrelated" ? { message: "missing" } : null,
        };
        return { data: [], error: null };
      }
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const goal = {
  goalId: "goal-proof", tenantId: "operationos", actorId: "founder",
  objective: "Discover the internal workflow and propose its agent architecture.",
  inputs: { brief: "Internal workflow only" },
  acceptanceCriteria: [{ id: "criterion-proof", description: "Verified proposal", evaluator: "deterministic" as const, required: true }],
  constraints: ["No external actions"], requestedAt: now, idempotencyKey: "proof-goal-2026-09-24",
};
const record = {
  executionId: "execution-proof", tenantId: "operationos", idempotencyKey: goal.idempotencyKey,
  goal, status: "queued" as const, createdAt: now,
  snapshot: {
    executionId: "execution-proof", goalId: goal.goalId, managerVersionId: "manager-v1",
    specialistVersionIds: ["workflow-v1", "architecture-v1"], policyBundleVersionId: "policy-v1",
    toolVersionIds: [], modelBindings: { manager: "deterministic" },
    maxSteps: 2, maxRetriesPerStep: 1, maxWallTimeMs: 10_000, createdAt: now,
  },
};

test("authoritative persistence rejects missing configuration or an unrelated tenant", () => {
  const { client } = database();
  assert.throws(() => new SupabaseAgentRuntimePersistence("another-tenant", "operationos", client));
  const previous = process.env.CONTROL_PLANE_DATA_MODE;
  process.env.CONTROL_PLANE_DATA_MODE = "fixture";
  try { assert.throws(() => new SupabaseAgentRuntimePersistence("operationos", "operationos", client)); }
  finally { process.env.CONTROL_PLANE_DATA_MODE = previous; }
});

test("validated execution identity, product and immutable snapshot are written through the server adapter", async () => {
  const { client, calls } = database();
  const adapter = new SupabaseAgentRuntimePersistence("operationos", "operationos", client);
  const created = await adapter.createOrGetExecution(record);
  assert.equal(created.created, true);
  assert.deepEqual(calls[0]?.value, {
    execution_id: record.executionId, tenant_id: "operationos", product_key: "operationos",
    goal_id: goal.goalId, actor_id: goal.actorId, idempotency_key: goal.idempotencyKey,
    goal, snapshot: record.snapshot, status: "queued", created_at: now, updated_at: now,
  });
  await adapter.transitionExecution(record.executionId, "queued", "planning", now);
  assert.equal(calls[1]?.filters.product_key, "operationos");
  assert.equal(calls[1]?.filters.status, "queued");
  await assert.rejects(adapter.transitionExecution(record.executionId, "queued", "succeeded", now));
  await assert.rejects(adapter.createOrGetExecution({ ...record, tenantId: "different" }));
});

test("database failure fails closed without disclosing the database error", async () => {
  const { client } = database({ fail: true });
  const adapter = new SupabaseAgentRuntimePersistence("operationos", "operationos", client);
  await assert.rejects(adapter.createOrGetExecution(record), (error: Error) => {
    assert.doesNotMatch(error.message, /private database detail/);
    return true;
  });
});

test("unrelated product, raw secret and hidden reasoning cannot enter the trace writer", async () => {
  const badProduct = new SupabaseAgentRuntimePersistence("operationos", "operationos", database({ product: "unrelated" }).client);
  const good = database();
  const adapter = new SupabaseAgentRuntimePersistence("operationos", "operationos", good.client);
  const event = {
    eventId: "event-1", executionId: "execution-proof", sequence: 1, type: "execution.created" as const,
    occurredAt: now, actor: { kind: "runtime" as const, id: "runtime" }, versionRefs: {}, payload: { status: "queued" },
  };
  await assert.rejects(badProduct.appendTrace(event));
  await assert.rejects(adapter.appendTrace({ ...event, payload: { hidden_reasoning: "private" } }));
  await assert.rejects(adapter.appendTrace({ ...event, payload: { token: "private" } }));
  assert.equal(good.calls.length, 0);
  await adapter.appendTrace(event);
  assert.equal(good.calls[1]?.table, "agent_runtime_trace_events");
  assert.equal(good.calls[1]?.action, "insert");
});

test.after(() => {
  if (originalMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
  else process.env.CONTROL_PLANE_DATA_MODE = originalMode;
  if (originalTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
  else process.env.CONTROL_PLANE_TENANT_ID = originalTenant;
});
