import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "../supabase/server-client";
import type { AuthoritativeApprovalResolver, AuthoritativeRollbackController, GovernanceAction } from "./governance";

type ApprovalAction = Extract<GovernanceAction, { action: "resolve_approval" }>;
type RollbackAction = Extract<GovernanceAction, { action: "request_canary_rollback" }>;

export class SupabaseGovernanceAdapter implements AuthoritativeApprovalResolver, AuthoritativeRollbackController {
  constructor(private readonly tenantId: string, private readonly client: SupabaseClient = getServerSupabaseClient()) {
    if (!tenantId.trim()) throw new Error("Authoritative governance tenant is required");
  }

  async resolveBoundApproval(input: ApprovalAction): Promise<{ approvalId: string; status: "approved" | "rejected" }> {
    const { data, error } = await this.client.rpc("control_plane_resolve_approval", {
      p_tenant_id: this.tenantId,
      p_product_key: input.productKey,
      p_approval_id: input.approvalId,
      p_actor_id: input.actorId,
      p_action_digest: input.actionDigest,
      p_decision: input.decision,
      p_resolved_at: input.resolvedAt,
    });
    if (error || !Array.isArray(data) || data.length !== 1) throw new Error("Authoritative approval resolution failed");
    const row = data[0] as Record<string, unknown>;
    if (row.approval_id !== input.approvalId || row.status !== input.decision) throw new Error("Authoritative approval result mismatch");
    return Object.freeze({ approvalId: input.approvalId, status: input.decision });
  }

  async requestBoundRollback(input: RollbackAction): Promise<{ eventId: string; state: "rolled_back" }> {
    const eventId = `rollback-${randomUUID()}`;
    const { data, error } = await this.client.rpc("control_plane_request_rollback", {
      p_tenant_id: this.tenantId,
      p_product_key: input.productKey,
      p_canary_id: input.canaryId,
      p_candidate_version_id: input.candidateVersionId,
      p_rollback_version_id: input.rollbackVersionId,
      p_conditions_digest: input.conditionsDigest,
      p_actor_id: input.actorId,
      p_event_id: eventId,
      p_requested_at: input.requestedAt,
    });
    if (error || !Array.isArray(data) || data.length !== 1) throw new Error("Authoritative rollback request failed");
    const row = data[0] as Record<string, unknown>;
    if (row.event_id !== eventId || row.state !== "rolled_back") throw new Error("Authoritative rollback result mismatch");
    return Object.freeze({ eventId, state: "rolled_back" as const });
  }
}

export function getConfiguredGovernanceAdapter(): SupabaseGovernanceAdapter {
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative") throw new Error("Authoritative governance is not configured");
  const tenantId = process.env.CONTROL_PLANE_TENANT_ID?.trim();
  if (!tenantId) throw new Error("CONTROL_PLANE_TENANT_ID is required for governance");
  return new SupabaseGovernanceAdapter(tenantId);
}
