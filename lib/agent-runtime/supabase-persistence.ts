import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agentDefinitionSchema, approvalRequestSchema, outcomeSignalSchema,
  agentAssignmentSchema,
  policyBundleVersionSchema, toolDefinitionSchema, traceEventSchema,
  userGoalSchema, executionSnapshotSchema,
  type ExecutionStatus,
} from "./contracts";
import { assertExecutionTransition } from "./state";
import type { AgentRuntimePersistence } from "./persistence";
import type { ExecutionRecord } from "./execution-repository";
import { getServerSupabaseClient } from "../supabase/server-client";

const prohibited = /^(?:authorization|cookie|password|secret|token|apikey|api_key|service_role_key|chain_of_thought|hidden_reasoning|hiddenreasoning|internalreasoning|raw_provider_error)$/i;

/** Reject raw sensitive data at the write boundary; never silently strip evidence. */
export function assertSafeRuntimePayload(value: unknown, maxBytes = 8_000): void {
  const visit = (item: unknown): void => {
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (prohibited.test(key) && child !== "[REDACTED]") throw new Error("Sensitive runtime data cannot be persisted");
      visit(child);
    }
  };
  visit(value);
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes) {
    throw new Error("Runtime persistence payload exceeds the allowed size");
  }
}

function requireTenant(tenantId: string): string {
  if (!tenantId || tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim()) {
    throw new Error("Runtime tenant does not match the configured authoritative tenant");
  }
  if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative") {
    throw new Error("Authoritative runtime persistence is not configured");
  }
  return tenantId;
}

function checked(error: { message: string } | null, action: string): void {
  if (error) throw new Error(`Runtime persistence ${action} failed`);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class SupabaseAgentRuntimePersistence implements AgentRuntimePersistence {
  constructor(
    private readonly tenantId: string,
    private readonly productKey: string,
    private readonly client: SupabaseClient = getServerSupabaseClient(),
  ) {
    requireTenant(tenantId);
    if (!/^[a-z][a-z0-9._-]*$/.test(productKey)) throw new Error("Invalid runtime product key");
  }

  async loadAgentDefinitions(tenantId: string) {
    if (tenantId !== this.tenantId) throw new Error("Cross-tenant registry read denied");
    const { data, error } = await this.client.from("agent_runtime_agent_definitions")
      .select("definition").eq("tenant_id", this.tenantId).eq("status", "active");
    checked(error, "agent registry read");
    return (data ?? []).map((row) => agentDefinitionSchema.parse(row.definition));
  }

  async loadToolDefinitions(tenantId: string) {
    if (tenantId !== this.tenantId) throw new Error("Cross-tenant registry read denied");
    const { data, error } = await this.client.from("agent_runtime_tool_definitions")
      .select("definition").eq("tenant_id", this.tenantId);
    checked(error, "tool registry read");
    return (data ?? []).map((row) => toolDefinitionSchema.parse(row.definition));
  }

  async loadPolicyVersions(tenantId: string) {
    if (tenantId !== this.tenantId) throw new Error("Cross-tenant registry read denied");
    const { data, error } = await this.client.from("agent_runtime_policy_bundle_versions")
      .select("definition").eq("tenant_id", this.tenantId).eq("status", "active");
    checked(error, "policy registry read");
    return (data ?? []).map((row) => policyBundleVersionSchema.parse(row.definition));
  }

  async createOrGetExecution(record: ExecutionRecord) {
    requireTenant(record.tenantId);
    const goal = userGoalSchema.parse(record.goal);
    const snapshot = executionSnapshotSchema.parse(record.snapshot);
    if (goal.tenantId !== this.tenantId || goal.idempotencyKey !== record.idempotencyKey ||
        goal.goalId !== snapshot.goalId || record.executionId !== snapshot.executionId || record.status !== "queued") {
      throw new Error("Execution identity and immutable snapshot disagree");
    }
    assertSafeRuntimePayload(goal);
    assertSafeRuntimePayload(snapshot);
    const { data, error } = await this.client.from("agent_runtime_executions").insert({
      execution_id: record.executionId, tenant_id: this.tenantId, product_key: this.productKey,
      goal_id: goal.goalId, actor_id: goal.actorId, idempotency_key: goal.idempotencyKey,
      goal, snapshot, status: "queued", created_at: record.createdAt, updated_at: record.createdAt,
    }).select("execution_id").single();
    if (!error) {
      if (data?.execution_id !== record.executionId) throw new Error("Runtime persistence returned a mismatched execution");
      return { record, created: true };
    }
    if (error.code !== "23505") checked(error, "execution create");
    const existing = await this.client.from("agent_runtime_executions")
      .select("execution_id,goal_id,actor_id,idempotency_key,goal,snapshot,status,created_at")
      .eq("tenant_id", this.tenantId).eq("product_key", this.productKey)
      .eq("idempotency_key", record.idempotencyKey).single();
    checked(existing.error, "idempotency lookup");
    if (!existing.data || existing.data.goal_id !== goal.goalId || existing.data.actor_id !== goal.actorId ||
        canonical(existing.data.goal) !== canonical(goal) ||
        existing.data.snapshot?.goalId !== goal.goalId) {
      throw new Error("Idempotency key belongs to a different goal");
    }
    const stored = existing.data;
    return { record: {
      executionId: stored.execution_id, tenantId: this.tenantId,
      idempotencyKey: stored.idempotency_key, goal: userGoalSchema.parse(stored.goal),
      snapshot: executionSnapshotSchema.parse(stored.snapshot), status: "queued" as const,
      createdAt: stored.created_at,
    }, created: false };
  }

  async transitionExecution(executionId: string, from: ExecutionStatus, to: ExecutionStatus, at: string): Promise<void> {
    assertExecutionTransition(from, to);
    const { data, error } = await this.client.from("agent_runtime_executions")
      .update({ status: to, updated_at: at }).eq("tenant_id", this.tenantId)
      .eq("product_key", this.productKey).eq("execution_id", executionId).eq("status", from)
      .select("execution_id").single();
    checked(error, "execution transition");
    if (data?.execution_id !== executionId) throw new Error("Execution transition lost its identity");
  }

  private async assertExecutionScope(executionId: string): Promise<void> {
    const { data, error } = await this.client.from("agent_runtime_executions")
      .select("execution_id").eq("tenant_id", this.tenantId).eq("product_key", this.productKey)
      .eq("execution_id", executionId).single();
    checked(error, "execution scope lookup");
    if (data?.execution_id !== executionId) throw new Error("Execution does not belong to the configured product");
  }

  async persistStepAttempt(record: import("./state").StepAttemptRecord): Promise<void> {
    await this.assertExecutionScope(record.executionId);
    const row = {
      step_attempt_id: record.stepAttemptId, tenant_id: this.tenantId,
      execution_id: record.executionId, step_id: record.stepId, attempt: record.attempt,
      retry_of_step_attempt_id: record.retryOfStepAttemptId ?? null,
      status: record.status, created_at: record.createdAt, updated_at: record.updatedAt,
    };
    if (record.status === "pending") {
      checked((await this.client.from("agent_runtime_execution_steps").insert(row)).error, "attempt create");
    } else {
      const { data, error } = await this.client.from("agent_runtime_execution_steps")
        .update({ status: record.status, updated_at: record.updatedAt })
        .eq("tenant_id", this.tenantId).eq("execution_id", record.executionId)
        .eq("step_attempt_id", record.stepAttemptId).eq("step_id", record.stepId)
        .eq("attempt", record.attempt).select("step_attempt_id").single();
      checked(error, "attempt transition");
      if (data?.step_attempt_id !== record.stepAttemptId) throw new Error("Attempt transition lost its identity");
    }
  }

  async persistAssignment(input: import("./contracts").AgentAssignment, stepAttemptId: string, agentKey: string): Promise<void> {
    const assignment = agentAssignmentSchema.parse(input);
    if (!/^[a-z][a-z0-9._-]*$/.test(agentKey)) throw new Error("Invalid specialist key");
    await this.assertExecutionScope(assignment.executionId);
    // The assignment is a bounded reference projection. The original objective
    // and any goal input remain on the immutable execution, not in this row.
    const safeAssignment = {
      executionId: assignment.executionId, stepId: assignment.stepId,
      attempt: assignment.attempt, assignedAgentKey: agentKey,
      contextRefs: assignment.contextRefs, expectedOutputSchema: assignment.expectedOutputSchema,
    };
    assertSafeRuntimePayload(safeAssignment);
    const { data, error } = await this.client.from("agent_runtime_execution_steps")
      .update({ assignment: safeAssignment }).eq("tenant_id", this.tenantId)
      .eq("execution_id", assignment.executionId).eq("step_attempt_id", stepAttemptId)
      .eq("step_id", assignment.stepId).eq("attempt", assignment.attempt)
      .eq("status", "running").select("step_attempt_id").single();
    checked(error, "assignment record");
    if (data?.step_attempt_id !== stepAttemptId) throw new Error("Assignment attempt identity mismatch");
  }

  async appendTrace(input: import("./contracts").TraceEvent): Promise<void> {
    const event = traceEventSchema.parse(input);
    if (event.payload.bounded === true) {
      throw new Error("Unpersisted trace artifacts cannot be referenced by authoritative traces");
    }
    assertSafeRuntimePayload(event.payload);
    if (event.error) assertSafeRuntimePayload(event.error);
    await this.assertExecutionScope(event.executionId);
    const { error } = await this.client.from("agent_runtime_trace_events").insert({
      event_id: event.eventId, tenant_id: this.tenantId, execution_id: event.executionId,
      sequence: event.sequence, event_type: event.type, actor: event.actor,
      version_refs: event.versionRefs, payload: event.payload, error: event.error ?? null,
      occurred_at: event.occurredAt,
    });
    checked(error, "trace append");
  }

  async appendOutcome(input: import("./contracts").OutcomeSignal): Promise<void> {
    const signal = outcomeSignalSchema.parse(input);
    await this.assertExecutionScope(signal.executionId);
    checked((await this.client.from("agent_runtime_outcome_signals").insert({
      signal_id: signal.signalId, tenant_id: this.tenantId, execution_id: signal.executionId,
      metric_key: signal.metricKey, metric_value: signal.value, unit: signal.unit,
      source: signal.source, evaluator_version_id: signal.evaluatorVersionId ?? null,
      recorded_at: signal.recordedAt,
    })).error, "outcome append");
  }

  async createApproval(input: import("./contracts").ApprovalRequest): Promise<void> {
    const request = approvalRequestSchema.parse(input);
    assertSafeRuntimePayload(request.summary, 4_000);
    // Candidate-only requests need a durable candidate registry before product
    // ownership can be proven. Do not infer scope from a user-supplied ID.
    if (!request.executionId) throw new Error("Candidate approval requires an authoritative candidate binding");
    await this.assertExecutionScope(request.executionId);
    checked((await this.client.from("agent_runtime_approval_requests").insert({
      approval_id: request.approvalId, tenant_id: this.tenantId, product_key: this.productKey,
      execution_id: request.executionId ?? null, candidate_id: request.candidateId ?? null,
      requested_by: request.requestedBy, actor_id: request.actorId, action_type: request.actionType,
      risk_level: request.riskLevel, approval_type: request.approvalType,
      action_digest: request.actionDigest, summary: request.summary,
      expires_at: request.expiresAt, status: request.status,
    })).error, "approval create");
  }
}
