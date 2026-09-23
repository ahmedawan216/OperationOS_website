import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { agentDefinitionSchema } from "../agent-runtime/contracts";
import {
  agentSummarySchema,
  approvalSummarySchema,
  canarySummarySchema,
  controlPlaneSnapshotSchema,
  evaluationSummarySchema,
  eventSummarySchema,
  executionSummarySchema,
  improvementSummarySchema,
  learningSummarySchema,
  productSummarySchema,
  safetySummarySchema,
  versionSummarySchema,
  type ControlPlaneSnapshot,
} from "./contracts";
import type { ControlPlaneDataProvider } from "./provider";

const id = z.string().trim().min(1).max(200);
const time = z.string().datetime({ offset: true });

const agentRowSchema = z.object({ definition: z.unknown() });
const deploymentRowSchema = z.object({ deployment_id: id, product_key: id, environment: z.enum(["test", "preview", "production"]), manifest: z.unknown(), status: z.enum(["candidate", "canary", "active", "rolled_back", "retired"]), created_at: time });
const executionRowSchema = z.object({ execution_id: id, product_key: id, goal_id: id, status: id, created_at: time, updated_at: time });
const stepRowSchema = z.object({ execution_id: id, attempt: z.number().int().positive(), assignment: z.unknown().nullable(), status: id });
const traceRowSchema = z.object({ execution_id: id, event_type: id });
const outcomeRowSchema = z.object({ execution_id: id, metric_key: id });
const approvalRowSchema = z.object({ approval_id: id, product_key: id, execution_id: id.nullable(), candidate_id: id.nullable(), actor_id: id, action_type: id, risk_level: z.enum(["low", "medium", "high"]), action_digest: id, expires_at: time, status: z.enum(["pending", "approved", "rejected", "expired", "consumed"]) });
const recordRowSchema = z.object({ record_id: id, product_key: id, record_kind: z.enum(["product", "learning", "improvement", "evaluation", "safety", "canary", "event"]), schema_version: z.literal("control-plane-snapshot-v1"), source_record_id: id, source_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/), payload: z.unknown(), occurred_at: time });

export interface AuthoritativeControlPlaneRows {
  agents: readonly unknown[];
  deployments: readonly unknown[];
  executions: readonly unknown[];
  steps: readonly unknown[];
  traces: readonly unknown[];
  outcomes: readonly unknown[];
  approvals: readonly unknown[];
  records: readonly unknown[];
}

export interface AuthoritativeControlPlaneRepository {
  load(input: { tenantId: string; productKey?: string }): Promise<AuthoritativeControlPlaneRows>;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function assignmentAgent(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const assignment = value as Record<string, unknown>;
  const key = assignment.assignedAgentKey ?? assignment.agentKey;
  return typeof key === "string" && /^[a-z][a-z0-9._-]*$/.test(key) ? key : undefined;
}

function parseProjectionRecords(rows: readonly unknown[]) {
  const products: z.infer<typeof productSummarySchema>[] = [];
  const learnings: z.infer<typeof learningSummarySchema>[] = [];
  const improvements: z.infer<typeof improvementSummarySchema>[] = [];
  const evaluations: z.infer<typeof evaluationSummarySchema>[] = [];
  const safety: z.infer<typeof safetySummarySchema>[] = [];
  const canaries: z.infer<typeof canarySummarySchema>[] = [];
  const recentEvents: z.infer<typeof eventSummarySchema>[] = [];
  for (const raw of rows) {
    const row = recordRowSchema.parse(raw);
    const parsed = row.record_kind === "product" ? productSummarySchema.parse(row.payload)
      : row.record_kind === "learning" ? learningSummarySchema.parse(row.payload)
      : row.record_kind === "improvement" ? improvementSummarySchema.parse(row.payload)
      : row.record_kind === "evaluation" ? evaluationSummarySchema.parse(row.payload)
      : row.record_kind === "safety" ? safetySummarySchema.parse(row.payload)
      : row.record_kind === "canary" ? canarySummarySchema.parse(row.payload)
      : eventSummarySchema.parse(row.payload);
    if ("productKey" in parsed && parsed.productKey !== row.product_key) throw new Error("Authoritative Control Plane record crosses product context");
    if (row.record_kind === "product") products.push(parsed as z.infer<typeof productSummarySchema>);
    else if (row.record_kind === "learning") learnings.push(parsed as z.infer<typeof learningSummarySchema>);
    else if (row.record_kind === "improvement") improvements.push(parsed as z.infer<typeof improvementSummarySchema>);
    else if (row.record_kind === "evaluation") evaluations.push(parsed as z.infer<typeof evaluationSummarySchema>);
    else if (row.record_kind === "safety") safety.push(parsed as z.infer<typeof safetySummarySchema>);
    else if (row.record_kind === "canary") canaries.push(parsed as z.infer<typeof canarySummarySchema>);
    else recentEvents.push(parsed as z.infer<typeof eventSummarySchema>);
  }
  return { products, learnings, improvements, evaluations, safety, canaries, recentEvents };
}

export class AuthoritativeControlPlaneProvider implements ControlPlaneDataProvider {
  readonly mode = "authoritative" as const;

  constructor(private readonly repository: AuthoritativeControlPlaneRepository, private readonly tenantId: string, private readonly now: () => Date = () => new Date()) {
    if (!tenantId.trim()) throw new Error("Authoritative Control Plane tenant is required");
  }

  async readSnapshot(input: { founderId: string; productKey?: string }): Promise<ControlPlaneSnapshot> {
    if (!input.founderId) throw new Error("Authorized founder identity is required");
    const raw = await this.repository.load({ tenantId: this.tenantId, productKey: input.productKey });
    const agentRows = raw.agents.map((row) => agentRowSchema.parse(row));
    const deploymentRows = raw.deployments.map((row) => deploymentRowSchema.parse(row));
    const executionRows = raw.executions.map((row) => executionRowSchema.parse(row));
    const stepRows = raw.steps.map((row) => stepRowSchema.parse(row));
    const traceRows = raw.traces.map((row) => traceRowSchema.parse(row));
    const outcomeRows = raw.outcomes.map((row) => outcomeRowSchema.parse(row));
    const approvalRows = raw.approvals.map((row) => approvalRowSchema.parse(row));
    const projections = parseProjectionRecords(raw.records);

    const agents = agentRows.map(({ definition }) => {
      const agent = agentDefinitionSchema.parse(definition);
      return agentSummarySchema.parse({
        agentKey: agent.agentKey,
        role: agent.role,
        versionId: agent.versionId,
        status: agent.status === "active" ? "active" : "inactive",
        capabilityKeys: agent.capabilityGrants.map((grant) => grant.capabilityKey),
        boundarySummary: agent.purpose,
        recentExecutionCount: stepRows.filter((step) => assignmentAgent(step.assignment) === agent.agentKey).length,
      });
    });

    const executions = executionRows.map((execution) => {
      const executionSteps = stepRows.filter((step) => step.execution_id === execution.execution_id);
      const executionTraces = traceRows.filter((trace) => trace.execution_id === execution.execution_id);
      return executionSummarySchema.parse({
        executionId: execution.execution_id,
        productKey: execution.product_key,
        goalSummary: `Runtime goal ${execution.goal_id}`,
        state: execution.status,
        agentKeys: [...new Set(executionSteps.map((step) => assignmentAgent(step.assignment)).filter((key): key is string => Boolean(key)))],
        startedAt: execution.created_at,
        completedAt: ["succeeded", "failed", "cancelled"].includes(execution.status) ? execution.updated_at : undefined,
        retries: executionSteps.filter((step) => step.attempt > 1).length,
        replans: executionTraces.filter((trace) => trace.event_type === "plan.revised").length,
        verificationStatus: execution.status === "succeeded" ? "passed" : execution.status === "failed" ? "failed" : "pending",
        outcomeSignalKeys: [...new Set(outcomeRows.filter((signal) => signal.execution_id === execution.execution_id).map((signal) => signal.metric_key))],
        traceEventCount: executionTraces.length,
      });
    });

    const approvals = approvalRows.map((approval) => approvalSummarySchema.parse({
      productKey: approval.product_key,
      approvalId: approval.approval_id,
      actionType: approval.action_type,
      subjectId: approval.candidate_id ?? approval.execution_id,
      actionDigest: approval.action_digest,
      payloadSummary: `${approval.action_type} for ${approval.candidate_id ?? approval.execution_id}`,
      risk: approval.risk_level,
      status: approval.status,
      expiresAt: approval.expires_at,
    }));

    const versions = deploymentRows.map((deployment) => versionSummarySchema.parse({
      productKey: deployment.product_key,
      versionId: deployment.deployment_id,
      status: deployment.status === "active" ? "known_good" : "candidate",
      digest: digest(deployment.manifest),
      pointer: deployment.status === "active" ? "known_good" : deployment.status === "canary" ? "canary" : "none",
      createdAt: deployment.created_at,
    }));

    const terminal = executions.filter((execution) => ["succeeded", "failed", "cancelled"].includes(execution.state));
    const succeeded = terminal.filter((execution) => execution.state === "succeeded").length;
    return controlPlaneSnapshotSchema.parse({
      contractVersion: "control-plane-snapshot-v1",
      generatedAt: this.now().toISOString(),
      sourceMode: "authoritative",
      products: projections.products,
      agents,
      executions,
      learnings: projections.learnings,
      improvements: projections.improvements,
      evaluations: projections.evaluations,
      safety: projections.safety,
      approvals,
      versions,
      canaries: projections.canaries,
      health: {
        state: projections.safety.some((assessment) => assessment.severity === "high") ? "critical" : approvals.some((approval) => approval.status === "pending") ? "attention" : "healthy",
        successRate: terminal.length ? succeeded / terminal.length : null,
        verificationFailures: executions.filter((execution) => execution.verificationStatus === "failed").length,
        retries: executions.reduce((total, execution) => total + execution.retries, 0),
        replans: executions.reduce((total, execution) => total + execution.replans, 0),
        providerFailures: 0,
        openSafetyFindings: projections.safety.filter((assessment) => assessment.runtimeDisposition !== "allow_for_evaluation").length,
        traceStoreHealthy: true,
        measuredAt: this.now().toISOString(),
      },
      recentEvents: projections.recentEvents,
    });
  }
}
