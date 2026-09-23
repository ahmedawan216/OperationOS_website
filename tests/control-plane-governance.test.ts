import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { ApprovalLedger } from "../lib/agent-runtime/approvals";
import type { ApprovalRequest } from "../lib/agent-runtime/contracts";
import { executeGovernanceAction } from "../lib/control-plane/governance";
import { SupabaseGovernanceAdapter } from "../lib/control-plane/supabase-governance";
import { fixtureSnapshot } from "../lib/control-plane/testing/fixture-provider";

const now = "2026-09-22T18:00:00.000Z";
const pending = fixtureSnapshot.approvals[0]!;
const approved = { ...pending, status: "approved" as const };

function ledger(): ApprovalLedger {
  let used = false;
  return {
    add(value) { return value; },
    get() { return undefined; },
    consume(input) {
      if (used) throw new Error("used");
      used = true;
      if (input.actionDigest !== approved.actionDigest || input.actorId !== "founder") throw new Error("mismatch");
      return {
        approvalId: approved.approvalId,
        candidateId: approved.subjectId,
        requestedBy: "runtime",
        actorId: "founder",
        actionType: "candidate.canary.start",
        riskLevel: "medium",
        approvalType: "human",
        actionDigest: approved.actionDigest,
        summary: "Exact",
        expiresAt: "2026-09-23T18:00:00.000Z",
        status: "consumed",
        resolvedBy: "founder",
        resolvedAt: now,
        consumedAt: now,
      } as ApprovalRequest;
    },
  };
}

test("governance consumes only an exact already-approved Day 1 action", async () => {
  const request = { action: "consume_approved_action" as const, productKey: approved.productKey, approvalId: approved.approvalId, subjectId: approved.subjectId, actionDigest: approved.actionDigest, actorId: "founder", consumedAt: now };
  const result = await executeGovernanceAction({ founderId: "founder", request, approval: approved, approvals: ledger() });
  assert.equal("status" in result && result.status, "consumed");
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request: { ...request, productKey: "other-product" }, approval: approved, approvals: ledger() }), /binding/);
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request, approval: pending, approvals: ledger() }), /unavailable/);
});

test("pending approval resolution is exact, founder-bound, and delegated once", async () => {
  const calls: unknown[] = [];
  const request = { action: "resolve_approval" as const, productKey: pending.productKey, approvalId: pending.approvalId, subjectId: pending.subjectId, actionDigest: pending.actionDigest, decision: "approved" as const, actorId: "founder", resolvedAt: now };
  const result = await executeGovernanceAction({ founderId: "founder", request, approval: pending, approvalResolver: { async resolveBoundApproval(value) { calls.push(value); return { approvalId: value.approvalId, status: value.decision }; } } });
  assert.deepEqual(result, { approvalId: pending.approvalId, status: "approved" });
  assert.equal(calls.length, 1);
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request: { ...request, actionDigest: `sha256:${"f".repeat(64)}` }, approval: pending, approvalResolver: { async resolveBoundApproval() { throw new Error("must not run"); } } }), /binding/);
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request, approval: approved, approvalResolver: { async resolveBoundApproval() { throw new Error("must not run"); } } }), /unavailable/);
});

test("unauthorized actor fails closed", async () => {
  const request = { action: "consume_approved_action" as const, productKey: approved.productKey, approvalId: approved.approvalId, subjectId: approved.subjectId, actionDigest: approved.actionDigest, actorId: "intruder", consumedAt: now };
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request, approval: approved, approvals: ledger() }), /not authorized/);
});

test("rollback reaches only the authoritative controller with exact frozen bindings", async () => {
  const canary = { ...fixtureSnapshot.canaries[0]!, state: "canary" as const };
  let called = false;
  const request = { action: "request_canary_rollback" as const, productKey: canary.productKey, canaryId: canary.canaryId, candidateVersionId: canary.candidateVersionId, rollbackVersionId: canary.rollbackVersionId, conditionsDigest: canary.conditionsDigest, actorId: "founder", requestedAt: now, reason: "Operator requested bounded rollback" };
  const result = await executeGovernanceAction({ founderId: "founder", request, canary, rollbackController: { async requestBoundRollback() { called = true; return { eventId: "rollback-event", state: "rolled_back" }; } } });
  assert.equal(called, true);
  assert.equal("state" in result && result.state, "rolled_back");
  await assert.rejects(() => executeGovernanceAction({ founderId: "founder", request: { ...request, conditionsDigest: `sha256:${"c".repeat(64)}` }, canary, rollbackController: { async requestBoundRollback() { throw new Error("must not run"); } } }), /binding/);
});

test("Supabase governance adapter validates exact RPC results", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = { async rpc(fn: string, args: Record<string, unknown>) { calls.push({ fn, args }); return fn === "control_plane_resolve_approval" ? { data: [{ approval_id: pending.approvalId, status: "rejected" }], error: null } : { data: [{ event_id: args.p_event_id, state: "rolled_back" }], error: null }; } };
  const adapter = new SupabaseGovernanceAdapter("tenant-1", client as never);
  await adapter.resolveBoundApproval({ action: "resolve_approval", productKey: pending.productKey, approvalId: pending.approvalId, subjectId: pending.subjectId, actionDigest: pending.actionDigest, decision: "rejected", actorId: "founder", resolvedAt: now });
  const canary = { ...fixtureSnapshot.canaries[0]!, state: "canary" as const };
  await adapter.requestBoundRollback({ action: "request_canary_rollback", productKey: canary.productKey, canaryId: canary.canaryId, candidateVersionId: canary.candidateVersionId, rollbackVersionId: canary.rollbackVersionId, conditionsDigest: canary.conditionsDigest, actorId: "founder", requestedAt: now, reason: "Bound rollback" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.args.p_tenant_id, "tenant-1");
  assert.equal(calls[1]?.args.p_conditions_digest, canary.conditionsDigest);
});

test("governance RPCs are server-only and refuse production rollback", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260923090000_control_plane_authoritative_records.sql", import.meta.url), "utf8");
  assert.match(sql, /control_plane_resolve_approval/);
  assert.match(sql, /control_plane_request_rollback/);
  assert.equal((sql.match(/security definer/g) ?? []).length, 2);
  assert.equal((sql.match(/set search_path = ''/g) ?? []).length >= 2, true);
  assert.match(sql, /revoke all on function public\.control_plane_resolve_approval[\s\S]+from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.control_plane_request_rollback[\s\S]+from public, anon, authenticated/);
  assert.match(sql, /canary_deployment\.environment = 'production'/);
  assert.match(sql, /status = 'active'[\s\S]+environment = canary_deployment\.environment/);
});
