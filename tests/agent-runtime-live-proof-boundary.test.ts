import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTROLLED_GROQ_MODEL, CONTROLLED_GROQ_MODEL_KEY, ProductionModelProvider } from "../lib/agent-runtime/production-model-provider";
import { controlledProduct, controlledRuntimeDefinitions, registerControlledProof } from "../lib/agent-runtime/controlled-proof-registration";
import { requestValidatedWorkflowModel } from "../lib/agent-runtime/specialist-provider";
import { workflowModelSchema } from "../lib/agent-runtime/specialist-contracts";
import { workflowInput, workflowModel } from "./fixtures/specialist-fixtures";
import { architectureProposal } from "./fixtures/specialist-fixtures";
import { resolveControlPlaneHost } from "../lib/control-plane/host-routing";
import { assertControlledAttempts, controlledArchitectureVerifier } from "../lib/agent-runtime/controlled-proof-runner";
import { controlledProofRun } from "../lib/agent-runtime/controlled-proof-runner";
import { requestValidatedManagerPlan } from "../lib/agent-runtime/manager-provider";
import type { ManagerPlanningRequest } from "../lib/agent-runtime/manager-contracts";

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
  assert.throws(() => controlledRuntimeDefinitions("deterministic-fake"), /approved controlled proof model/);
  assert.throws(() => controlledRuntimeDefinitions("gpt-controlled"), /approved controlled proof model/);
  const versions = controlledRuntimeDefinitions(CONTROLLED_GROQ_MODEL_KEY);
  assert.deepEqual(versions.agents.map((item) => item.agentKey),
    ["manager", "workflow_discovery_specialist", "agent_architecture_specialist"]);
  assert.ok(versions.agents.every((item) => item.status === "active" && item.capabilityGrants.length === 0));
  assert.equal(versions.policy.defaultDecision, "deny");
  assert.deepEqual(versions.agents[0]!.modelPolicy.allowedModelKeys, [CONTROLLED_GROQ_MODEL_KEY]);
  assert.throws(() => controlledRuntimeDefinitions(CONTROLLED_GROQ_MODEL), /approved controlled proof model/);
  assert.throws(() => controlledRuntimeDefinitions("openai/gpt-oss-120b"), /approved controlled proof model/);
  assert.throws(() => new ProductionModelProvider({ key: "", model: CONTROLLED_GROQ_MODEL, provider: "groq" }), /not configured/);
  assert.throws(() => new ProductionModelProvider({ key: "mock-secret", model: CONTROLLED_GROQ_MODEL,
    provider: "unknown" }), /not configured/);
  assert.throws(() => new ProductionModelProvider({ key: "mock-secret", model: "openai/gpt-oss-120b",
    provider: "groq" }), /not configured/);
});

test("live Manager planning is guided by the exact bounded two-step contract and still rejects invalid model output", async () => {
  assert.notEqual(controlledProofRun.idempotencyKey, "operationos-controlled-proof-initial-v1");
  assert.equal(controlledProofRun.idempotencyKey, "operationos-controlled-proof-initial-v4");
  assert.equal(controlledProofRun.goalId, "operationos-controlled-goal-initial-v4");
  const originalFetch = globalThis.fetch;
  const request = { planId: "plan-live", snapshot: { executionId: "execution-live" },
    goal: { acceptanceCriteria: [{ id: "verified-proposal", required: true }] } } as ManagerPlanningRequest;
  let system = "";
  const valid = { plan: { planId: "plan-live", executionId: "execution-live",
    rationaleSummary: "Discover before proposing a draft architecture.", steps: [
      { stepId: "workflow", sequence: 0, objective: "Discover workflow", assignedAgentKey: "workflow_discovery_specialist",
        inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-model-v1",
        acceptanceCriterionIds: [], requiredCapabilities: [], riskLevel: "low", dependsOn: [] },
      { stepId: "architecture", sequence: 1, objective: "Propose a draft architecture", assignedAgentKey: "agent_architecture_specialist",
        inputRefs: [{ kind: "step_output", id: "workflow" }], expectedOutputSchema: "agent-system-proposal-v1",
        acceptanceCriterionIds: ["verified-proposal"], requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow"] },
    ], verificationStepIds: ["architecture"] }, decisionSummary: "Use only declared evidence." };
  let output: unknown = valid;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body)) as { messages: Array<{ role: string; content: string }> };
      system = body.messages[0]!.content;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] }),
        { status: 200 });
    };
    const provider = new ProductionModelProvider({ key: "test-only-key", model: CONTROLLED_GROQ_MODEL, provider: "groq" });
    // The request object is deliberately minimal: the provider must not invent fields; runtime validates real requests.
    const response = await provider.generatePlan(request);
    assert.deepEqual(response.output, valid);
    for (const instruction of ["expectedOutputSchema", "acceptanceCriterionIds", "requiredCapabilities",
      "verificationStepIds", "agent-system-proposal-v1", "goal_input", "step_output", "riskLevel"]) {
      assert.ok(system.includes(instruction), `Missing bounded planning instruction: ${instruction}`);
    }
    // A provider cannot introduce extra authority even when guided by a valid plan example.
    const malformed = { ...valid, plan: { ...valid.plan, steps: [{ ...valid.plan.steps[0], forbiddenGrant: true }] } };
    output = malformed;
    await assert.rejects(() => requestValidatedManagerPlan(provider, {
      ...request, goal: { ...request.goal, goalId: "goal-live", tenantId: "operationos", actorId: "founder",
        objective: "Draft workflow architecture", inputs: { brief: "Internal draft" },
        acceptanceCriteria: [{ id: "verified-proposal", description: "Verified", evaluator: "deterministic", required: true }],
        constraints: [], requestedAt: "2026-09-24T00:00:00.000Z", idempotencyKey: controlledProofRun.idempotencyKey },
      snapshot: { ...request.snapshot, goalId: "goal-live", managerVersionId: "manager-v1",
        specialistVersionIds: ["workflow-v1", "architecture-v1"], policyBundleVersionId: "policy-v1",
        toolVersionIds: [], modelBindings: { manager: CONTROLLED_GROQ_MODEL_KEY }, maxSteps: 2,
        maxRetriesPerStep: 0, maxWallTimeMs: 115_000, maxCostUsd: 1, createdAt: "2026-09-24T00:00:00.000Z" },
      previousPlanIds: [],
    }), /validation|contract/i);
  } finally { globalThis.fetch = originalFetch; }
});

test("Groq's flattened Manager envelope is normalized before strict contract validation", async () => {
  const originalFetch = globalThis.fetch;
  const request = {
    goal: { goalId: "goal-live", tenantId: "operationos", actorId: "founder",
      objective: "Draft workflow architecture", inputs: { brief: "Internal draft" },
      acceptanceCriteria: [{ id: "verified-proposal", description: "Verified", evaluator: "deterministic", required: true }],
      constraints: [], requestedAt: "2026-09-24T00:00:00.000Z", idempotencyKey: controlledProofRun.idempotencyKey },
    snapshot: { executionId: "execution-live", goalId: "goal-live", managerVersionId: "manager-v1",
      specialistVersionIds: ["workflow-v1", "architecture-v1"], policyBundleVersionId: "policy-v1",
      toolVersionIds: [], modelBindings: { manager: CONTROLLED_GROQ_MODEL_KEY }, maxSteps: 2,
      maxRetriesPerStep: 0, maxWallTimeMs: 115_000, maxCostUsd: 1, createdAt: "2026-09-24T00:00:00.000Z" },
    planId: "plan-live", previousPlanIds: [],
  } satisfies ManagerPlanningRequest;
  const flattened = { planId: "plan-live", executionId: "execution-live",
    rationaleSummary: "Discover before proposing a draft architecture.", steps: [
      { stepId: "workflow", sequence: 0, objective: "Discover workflow", assignedAgentKey: "workflow_discovery_specialist",
        inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-model-v1",
        acceptanceCriterionIds: [], requiredCapabilities: [], riskLevel: "low", dependsOn: [] },
      { stepId: "architecture", sequence: 1, objective: "Propose a draft architecture", assignedAgentKey: "agent_architecture_specialist",
        inputRefs: [{ kind: "step_output", id: "workflow" }], expectedOutputSchema: "agent-system-proposal-v1",
        acceptanceCriterionIds: ["verified-proposal"], requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow"] },
    ], verificationStepIds: ["architecture"], decisionSummary: "Use only declared evidence." };
  let output: unknown = flattened;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: {
      content: JSON.stringify(output) } }] }), { status: 200 });
    const provider = new ProductionModelProvider({ key: "test-only-key", model: CONTROLLED_GROQ_MODEL, provider: "groq" });
    const normalized = await requestValidatedManagerPlan(provider, request);
    assert.deepEqual(normalized.proposal, {
      plan: { planId: flattened.planId, executionId: flattened.executionId,
        rationaleSummary: flattened.rationaleSummary, steps: flattened.steps,
        verificationStepIds: flattened.verificationStepIds },
      decisionSummary: flattened.decisionSummary,
    });

    output = { ...flattened, unexpectedAuthority: "grant" };
    await assert.rejects(() => requestValidatedManagerPlan(provider, request), /validation|contract/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Groq provider sends bounded schema-guided requests without reasoning and validates untrusted output", async () => {
  const originalFetch = globalThis.fetch;
  let body: Record<string, unknown> | undefined;
  let endpoint: unknown;
  try {
    globalThis.fetch = async (url, options) => {
      endpoint = url;
      body = JSON.parse(String(options?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: {
        content: JSON.stringify(workflowModel()), reasoning: "must never persist" } }],
        usage: { prompt_tokens: 40, completion_tokens: 120 } }),
        { status: 200 });
    };
    const provider = new ProductionModelProvider({ key: "mock-secret", model: CONTROLLED_GROQ_MODEL, provider: "groq" });
    assert.equal(provider.model, CONTROLLED_GROQ_MODEL_KEY);
    const response = await requestValidatedWorkflowModel(provider, workflowInput());
    assert.equal(response.model.status, "draft");
    assert.deepEqual(response.usage, { inputTokens: 40, outputTokens: 120 });
    assert.equal(endpoint, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(body?.model, CONTROLLED_GROQ_MODEL);
    assert.equal(body?.include_reasoning, false);
    assert.equal(body?.tools, undefined);
    const jsonSchema = (body?.response_format as { json_schema: { strict: boolean; schema: {
      properties: Record<string, unknown> } } }).json_schema;
    assert.equal(jsonSchema.strict, true);
    assert.deepEqual(jsonSchema.schema.properties.executionId, { const: workflowInput().assignment.executionId });
    assert.deepEqual(jsonSchema.schema.properties.stepId, { const: workflowInput().assignment.stepId });
    assert.deepEqual(jsonSchema.schema.properties.evidenceReferences, { const: workflowInput().evidence });
    assert.equal(JSON.stringify(body).includes("mock-secret"), false);
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length",
      message: { content: JSON.stringify(workflowModel()) } }] }), { status: 200 });
    await assert.rejects(() => provider.discoverWorkflow(workflowInput()), /unavailable or invalid/);
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop",
      message: { content: JSON.stringify({ ...workflowModel(), forbidden: "grant access" }) } }] }), { status: 200 });
    await assert.rejects(() => requestValidatedWorkflowModel(provider, workflowInput()));
    globalThis.fetch = async () => new Response("provider credentials: mock-secret", { status: 500 });
    await assert.rejects(() => provider.discoverWorkflow(workflowInput()), (error: unknown) =>
      error instanceof Error && /unavailable or invalid/.test(error.message) && !error.message.includes("mock-secret"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("V4 workflow violations remain rejected while Groq strict optionals normalize before authoritative validation", async () => {
  const malformed = structuredClone(workflowModel());
  malformed.stages[0]!.evidenceRefs = [];
  malformed.successCriteria[0]!.metricKey = "reviewCompletion";
  malformed.outputs.push({ outputId: "draftWorkflow", name: "Draft workflow", evidenceRefs: [] });
  malformed.stages.push({ ...malformed.stages[0]!, stageId: "stage-next", inputIds: ["draftWorkflow"],
    dependsOnStageIds: [malformed.stages[0]!.stageId], decisionIds: ["decision-next"], humanCheckpointIds: [] });
  malformed.decisions.push({ decisionId: "decision-next", stageId: "stage-next", condition: "Review complete",
    outcomes: [{ value: "Continue", nextStageId: "stage3" }, { value: "Stop" }], humanRequired: true,
    evidenceRefs: ["evidence-brief"] });
  const rejected = workflowModelSchema.safeParse(malformed);
  assert.equal(rejected.success, false);
  if (!rejected.success) {
    assert.ok(rejected.error.issues.some((issue) => issue.path.join(".") === "stages.0.evidenceRefs"));
    assert.ok(rejected.error.issues.some((issue) => issue.path.join(".") === "successCriteria.0.metricKey"));
    assert.ok(rejected.error.issues.some((issue) => issue.message === "Stage references unknown input: draftWorkflow"));
    assert.ok(rejected.error.issues.some((issue) => issue.message === "Decision outcome references unknown stage: stage3"));
  }

  const originalFetch = globalThis.fetch;
  const raw = structuredClone(workflowModel()) as unknown as Record<string, unknown>;
  const failure = (raw.failureConditions as Array<Record<string, unknown>>)[0]!;
  failure.stageId = null;
  failure.recoveryOwnerActorId = null;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: {
      content: JSON.stringify(raw) } }] }), { status: 200 });
    const provider = new ProductionModelProvider({ key: "test-only-key", model: CONTROLLED_GROQ_MODEL, provider: "groq" });
    const response = await requestValidatedWorkflowModel(provider, workflowInput());
    assert.equal("stageId" in response.model.failureConditions[0]!, false);
    assert.equal("recoveryOwnerActorId" in response.model.failureConditions[0]!, false);
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
    await assert.rejects(() => registerControlledProof({ tenantId: "another-tenant", model: CONTROLLED_GROQ_MODEL_KEY,
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
    const run = () => registerControlledProof({ tenantId: "operationos", model: CONTROLLED_GROQ_MODEL_KEY,
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
    await assert.rejects(() => registerControlledProof({ tenantId: "operationos", model: "openai/gpt-oss-120b",
      client, occurredAt: "2026-09-24T12:00:00.000Z" }), /approved controlled proof model/);
    assert.equal(writes, committed);
  } finally {
    if (beforeMode === undefined) delete process.env.CONTROL_PLANE_DATA_MODE;
    else process.env.CONTROL_PLANE_DATA_MODE = beforeMode;
    if (beforeTenant === undefined) delete process.env.CONTROL_PLANE_TENANT_ID;
    else process.env.CONTROL_PLANE_TENANT_ID = beforeTenant;
  }
});
