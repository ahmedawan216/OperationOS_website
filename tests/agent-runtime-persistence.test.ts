import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { dayOneAgentFixtures, dayOnePolicyFixture, dayOneToolFixtures } from "../lib/agent-runtime/fixtures";

const migration = readFileSync(
  new URL("../supabase/migrations/20260921165729_agent_runtime_foundation.sql", import.meta.url),
  "utf8",
);

test("migration contains every required Day 1 persistence table", () => {
  const tables = [
    "agent_runtime_agent_definitions",
    "agent_runtime_tool_definitions",
    "agent_runtime_policy_bundle_versions",
    "agent_runtime_deployments",
    "agent_runtime_executions",
    "agent_runtime_execution_steps",
    "agent_runtime_trace_events",
    "agent_runtime_outcome_signals",
    "agent_runtime_approval_requests",
  ];
  for (const table of tables) assert.match(migration, new RegExp(`create table public\\.${table}`));
});

test("migration enables RLS, removes client grants, and keeps service-role access", () => {
  assert.equal((migration.match(/enable row level security/g) ?? []).length, 9);
  assert.match(migration, /from public, anon, authenticated;/);
  assert.match(migration, /to service_role;/);
  assert.equal(/create policy/i.test(migration), false);
});

test("migration enforces append-only history and guarded state transitions", () => {
  assert.match(migration, /agent_runtime_trace_events_append_only/);
  assert.match(migration, /agent_runtime_agent_definitions_immutable/);
  assert.match(migration, /validate_execution_transition/);
  assert.match(migration, /validate_step_transition/);
  assert.match(migration, /unique \(execution_id, sequence\)/);
  assert.match(migration, /unique \(tenant_id, idempotency_key\)/);
});

test("Day 1 fixtures contain one manager, exactly two non-executable specialists, and safe/blocked tools", () => {
  assert.equal(dayOneAgentFixtures.filter((agent) => agent.role === "manager").length, 1);
  const specialists = dayOneAgentFixtures.filter((agent) => agent.role === "specialist");
  assert.deepEqual(specialists.map((agent) => agent.agentKey), [
    "workflow_discovery_specialist",
    "agent_architecture_specialist",
  ]);
  assert.equal(specialists.every((agent) => agent.status === "candidate"), true);
  assert.equal(specialists.every((agent) => agent.capabilityGrants.length === 0), true);
  assert.equal(dayOneToolFixtures.some((tool) => tool.sideEffect === "none" && tool.riskLevel === "low"), true);
  assert.equal(
    dayOneToolFixtures.some(
      (tool) => tool.sideEffect === "external_write" && tool.requiredApproval === "explicit_human",
    ),
    true,
  );
  assert.equal(dayOnePolicyFixture.defaultDecision, "deny");
});
