import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProductionModelProvider } from "../lib/agent-runtime/production-model-provider";
import { controlledProduct, controlledRuntimeDefinitions, registerControlledProof } from "../lib/agent-runtime/controlled-proof-registration";
import { requestValidatedWorkflowModel } from "../lib/agent-runtime/specialist-provider";
import { workflowInput, workflowModel } from "./fixtures/specialist-fixtures";
import { architectureProposal } from "./fixtures/specialist-fixtures";
import { resolveControlPlaneHost } from "../lib/control-plane/host-routing";
import { assertControlledAttempts, controlledArchitectureVerifier } from "../lib/agent-runtime/controlled-proof-runner";

test("controlled proof requires exactly the two persisted specialists with bounded prerequisite context", () => {
  const attempts = [
    { step_id: "discovery", status: "succeeded", assignment: { assignedAgentKey: "workflow_discovery_specialist",
      contextRefs: [{ kind: "goal_input", id: "brief" }] } },
    { step_id: "architecture", status: "succeeded", assignment: { assignedAgentKey: "agent_architecture_specialist",
      contextRefs: [{ kind: "step_output", id: "discovery" }] } },
  ];
  assert.doesNotThrow(() => assertControlledAttempts(attempts));
  assert.throws(() => assertControlledAttempts(attempts.slice(0, 1)));
  assert.throws(() => assertControlledAttempts([{ ...attempts[0]!, status: "failed" }, attempts[1]]));
  assert.throws(() => assertControlledAttempts([attempts[0], { ...attempts[1]!, assignment: {
    ...attempts[1]!.assignment, contextRefs: [{ kind: "step_output", id: "unrelated" }] } }]));
  assert.throws(() => assertControlledAttempts([attempts[0], { ...attempts[1]!, assignment: {
    ...attempts[1]!.assignment, contextRefs: [...attempts[1]!.assignment.contextRefs, { kind: "goal_input", id: "brief" }] } }]));
});

test("controlled manifest registers only draft capability, no tools or grants, and refuses fake models", () => {
  assert.equal(controlledProduct.product.productKey, "operationos");
  assert.deepEqual(controlledProduct.capabilities.map((item) => item.actionClass), ["draft"]);
  assert.deepEqual(controlledProduct.tools, []);
  assert.throws(() => controlledRuntimeDefinitions("deterministic-fake"), /real, pinned/);
  assert.throws(() => controlledRuntimeDefinitions("gpt-controlled"), /real, pinned/);
  const versions = controlledRuntimeDefinitions("gpt-controlled-2026-09-24");
  assert.deepEqual(versions.agents.map((item) => item.agentKey),
    ["manager", "workflow_discovery_specialist", "agent_architecture_specialist"]);
  assert.ok(versions.agents.every((item) => item.status === "active" && item.capabilityGrants.length === 0));
  assert.equal(versions.policy.defaultDecision, "deny");
  assert.notEqual(versions.agents[0]!.versionId, controlledRuntimeDefinitions("gpt-controlled-2026-09-25").agents[0]!.versionId);
  assert.throws(() => new ProductionModelProvider({ key: "", model: "gpt-controlled-2026-09-24" }), /not configured/);
});

test("founder proof endpoint remains private to the configured control host", () => {
  const path = "/api/control-plane/proof";
  assert.deepEqual(resolveControlPlaneHost({ hostname: "control.operationos.org", pathname: path,
    configuredHost: "control.operationos.org", requireConfiguredHost: true }),
    { disposition: "next", privateSurface: true });
  assert.deepEqual(resolveControlPlaneHost({ hostname: "operationos.org", pathname: path,
    configuredHost: "control.operationos.org", requireConfiguredHost: true }),
    { disposition: "deny", privateSurface: true });
});

test("controlled verification requires runtime step evidence, matching criterion and human checkpoint", async () => {
  const proposal = architectureProposal();
  const criterion = { id: "criterion-decision", description: "Sourced architecture with human approval",
    evaluator: "deterministic" as const, required: true };
  const completed = { executionId: "execution-1", stepId: "architecture-step", status: "completed" as const,
    output: proposal, evidenceRefs: [{ kind: "step_output" as const, id: "architecture-step" }], unmetCriteria: [] };
  const verify = (output: unknown) => controlledArchitectureVerifier.verify({ criterion,
    outputs: { "architecture-step": { ...completed, output } }, verificationStepIds: ["architecture-step"] });
  assert.equal((await verify(proposal) as { satisfied: boolean }).satisfied, true);
  assert.equal((await verify({ ...proposal, approvalRequirements: [] }) as { satisfied: boolean }).satisfied, false);
  assert.equal((await verify({ ...proposal, verificationResponsibilities: [] }) as { satisfied: boolean }).satisfied, false);
  const unrelated = await controlledArchitectureVerifier.verify({ criterion,
    outputs: { "architecture-step": completed }, verificationStepIds: ["another-step"] });
  assert.equal((unrelated as { satisfied: boolean }).satisfied, false);
});

test("real provider sends only bounded structured request and validates its untrusted response", async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> | undefined;
  try {
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(String(options?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(workflowModel()) }] }],
        usage: { input_tokens: 40, output_tokens: 120 } }),
        { status: 200 });
    };
    const provider = new ProductionModelProvider({ key: "mock-secret", model: "gpt-controlled-2026-09-24" });
    const response = await requestValidatedWorkflowModel(provider, workflowInput());
    assert.equal(response.model.status, "draft");
    assert.deepEqual(response.usage, { inputTokens: 40, outputTokens: 120 });
    assert.equal(body?.store, false);
    assert.equal(JSON.stringify(body).includes("mock-secret"), false);
    globalThis.fetch = async () => new Response("provider credentials: mock-secret", { status: 500 });
    await assert.rejects(() => provider.discoverWorkflow(workflowInput()), (error: unknown) =>
      error instanceof Error && /unavailable or invalid/.test(error.message) && !error.message.includes("mock-secret"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registration refuses a cross-tenant write before issuing any database request", async () => {
  const beforeMode = process.env.CONTROL_PLANE_DATA_MODE;
  const beforeTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  let called = false;
  const client = { from() { called = true; throw new Error("Should not query cross-tenant database"); } } as unknown as SupabaseClient;
  try {
    await assert.rejects(() => registerControlledProof({ tenantId: "another-tenant", model: "gpt-controlled-2026-09-24",
      client, occurredAt: "2026-09-24T00:00:00.000Z" }), /tenant/);
    assert.equal(called, false);
  } finally {
    if (beforeMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = beforeMode;
    if (beforeTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = beforeTenant;
  }
});

test("authoritative registration writes only immutable source-derived definitions and is idempotent", async () => {
  const beforeMode = process.env.CONTROL_PLANE_DATA_MODE;
  const beforeTenant = process.env.CONTROL_PLANE_TENANT_ID;
  process.env.CONTROL_PLANE_DATA_MODE = "authoritative";
  process.env.CONTROL_PLANE_TENANT_ID = "operationos";
  const rows = new Map<string, Record<string, unknown>[]>();
  let writes = 0;
  const client = { from(table: string) {
    let filters: Record<string, unknown> = {};
    let countOnly = false;
    const result = () => {
      const matches = (rows.get(table) ?? []).filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value));
      return countOnly ? { data: null, count: matches.length, error: null } : { data: matches, error: null };
    };
    const query = {
      select(_columns: string, options?: { head?: boolean }) { countOnly = !!options?.head; return query; },
      eq(key: string, value: unknown) { filters = { ...filters, [key]: value }; return query; },
      maybeSingle() { const value = result(); return Promise.resolve({ data: value.data?.[0] ?? null, error: null }); },
      single() { const value = result(); return Promise.resolve({ data: value.data?.[0] ?? null,
        error: value.data?.[0] ? null : { message: "No committed source" } }); },
      insert(row: Record<string, unknown>) { rows.set(table, [...(rows.get(table) ?? []), row]); writes++; return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve(result())); },
    };
    return query;
  } } as unknown as SupabaseClient;
  try {
    const run = () => registerControlledProof({ tenantId: "operationos", model: "gpt-controlled-2026-09-24",
      client, occurredAt: "2026-09-24T12:00:00.000Z" });
    const first = await run();
    assert.equal(first.agents.length, 3);
    assert.equal(rows.get("agent_runtime_agent_definitions")?.length, 3);
    assert.equal(rows.get("agent_runtime_policy_bundle_versions")?.length, 1);
    assert.equal(rows.get("agent_runtime_lifecycle_records")?.length, 1);
    assert.equal(rows.get("agent_runtime_control_plane_records")?.length, 1);
    const committed = writes;
    await run();
    assert.equal(writes, committed);
    await assert.rejects(() => registerControlledProof({ tenantId: "operationos", model: "gpt-different-2026-09-24",
      client, occurredAt: "2026-09-24T12:00:00.000Z" }), /differs/);
    assert.equal(writes, committed);
  } finally {
    if (beforeMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = beforeMode;
    if (beforeTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = beforeTenant;
  }
});
