import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "../supabase/server-client";
import type { AuthoritativeControlPlaneRepository, AuthoritativeControlPlaneRows } from "./authoritative-provider";

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

async function rows(query: PromiseLike<QueryResult>, label: string): Promise<readonly unknown[]> {
  const { data, error } = await query;
  if (error) throw new Error(`Authoritative Control Plane ${label} query failed`);
  return data ?? [];
}

export class SupabaseControlPlaneRepository implements AuthoritativeControlPlaneRepository {
  constructor(private readonly client: SupabaseClient = getServerSupabaseClient()) {}

  async load(input: { tenantId: string; productKey?: string }): Promise<AuthoritativeControlPlaneRows> {
    let executionsQuery = this.client.from("agent_runtime_executions").select("execution_id,product_key,goal_id,status,created_at,updated_at").eq("tenant_id", input.tenantId).order("created_at", { ascending: false }).limit(500);
    let deploymentsQuery = this.client.from("agent_runtime_deployments").select("deployment_id,product_key,environment,manifest,status,created_at").eq("tenant_id", input.tenantId).order("created_at", { ascending: false }).limit(500);
    let approvalsQuery = this.client.from("agent_runtime_approval_requests").select("approval_id,product_key,execution_id,candidate_id,actor_id,action_type,risk_level,action_digest,expires_at,status").eq("tenant_id", input.tenantId).order("created_at", { ascending: false }).limit(500);
    let recordsQuery = this.client.from("agent_runtime_control_plane_records").select("record_id,product_key,record_kind,schema_version,source_record_id,source_digest,payload,occurred_at").eq("tenant_id", input.tenantId).order("occurred_at", { ascending: false }).limit(2_000);
    if (input.productKey) {
      executionsQuery = executionsQuery.eq("product_key", input.productKey);
      deploymentsQuery = deploymentsQuery.eq("product_key", input.productKey);
      approvalsQuery = approvalsQuery.eq("product_key", input.productKey);
      recordsQuery = recordsQuery.eq("product_key", input.productKey);
    }
    const [agents, deployments, executions, approvals, records] = await Promise.all([
      rows(this.client.from("agent_runtime_agent_definitions").select("definition").eq("tenant_id", input.tenantId).eq("status", "active").limit(100), "agent"),
      rows(deploymentsQuery, "deployment"),
      rows(executionsQuery, "execution"),
      rows(approvalsQuery, "approval"),
      rows(recordsQuery, "record"),
    ]);
    const executionIds = executions.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const executionId = (value as Record<string, unknown>).execution_id;
      return typeof executionId === "string" ? [executionId] : [];
    });
    if (!executionIds.length) return { agents, deployments, executions, approvals, records, steps: [], traces: [], outcomes: [] };
    const [steps, traces, outcomes] = await Promise.all([
      rows(this.client.from("agent_runtime_execution_steps").select("execution_id,attempt,assignment,status").in("execution_id", executionIds).limit(5_000), "step"),
      rows(this.client.from("agent_runtime_trace_events").select("execution_id,event_type").in("execution_id", executionIds).order("sequence", { ascending: true }).limit(10_000), "trace"),
      rows(this.client.from("agent_runtime_outcome_signals").select("execution_id,metric_key").in("execution_id", executionIds).limit(5_000), "outcome"),
    ]);
    return { agents, deployments, executions, approvals, records, steps, traces, outcomes };
  }
}

export function createSupabaseControlPlaneRepository(): AuthoritativeControlPlaneRepository {
  return new SupabaseControlPlaneRepository();
}
