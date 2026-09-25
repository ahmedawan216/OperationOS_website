import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthoritativeManager } from "./authoritative-manager";
import { registerControlledProof } from "./controlled-proof-registration";
import { ProductionModelProvider } from "./production-model-provider";
import { agentSystemProposalSchema } from "./specialist-contracts";
import { observeAuthoritativeGoal } from "./authoritative-observation";
import type { AcceptanceCriterionVerifier } from "./manager-verification";

// Earlier live attempts remain immutable. The next diagnostic run gets its own
// idempotency boundary; rejected provider output is never retained or retried.
export const controlledProofRun = Object.freeze({
  goalId: "operationos-controlled-goal-initial-v5",
  idempotencyKey: "operationos-controlled-proof-initial-v5",
});

const attemptSchema = z.array(z.object({
  step_id: z.string().min(1), status: z.literal("succeeded"),
  assignment: z.object({ assignedAgentKey: z.enum(["workflow_discovery_specialist", "agent_architecture_specialist"]),
    contextRefs: z.array(z.object({ kind: z.enum(["goal_input", "step_output"]), id: z.string().min(1) }).passthrough()) }),
}).passthrough()).length(2);

export function assertControlledAttempts(input: unknown): void {
  const attempts = attemptSchema.parse(input);
  const workflow = attempts.find((item) => item.assignment.assignedAgentKey === "workflow_discovery_specialist");
  const architecture = attempts.find((item) => item.assignment.assignedAgentKey === "agent_architecture_specialist");
  if (!workflow || !architecture || workflow.assignment.contextRefs.length !== 1 ||
    workflow.assignment.contextRefs[0]?.kind !== "goal_input" || workflow.assignment.contextRefs[0].id !== "brief" ||
    architecture.assignment.contextRefs.length !== 1 ||
    architecture.assignment.contextRefs[0]?.kind !== "step_output" ||
    architecture.assignment.contextRefs[0].id !== workflow.step_id) {
    throw new Error("Controlled proof assignments must preserve the exact bounded prerequisite context");
  }
}

export const controlledArchitectureVerifier: AcceptanceCriterionVerifier = {
  versionId: "operationos-controlled-architecture-verifier-v1",
  async verify({ criterion, outputs, verificationStepIds }) {
    const evidence = verificationStepIds.flatMap((stepId) => {
      const result = outputs[stepId];
      if (result?.status !== "completed") return [];
      const parsed = agentSystemProposalSchema.safeParse(result.output);
      if (!parsed.success) return [];
      const proposal = parsed.data;
      return proposal.status === "proposal" && proposal.agents.length > 0 &&
        proposal.verificationResponsibilities.some((item) => item.criterionId === criterion.id &&
          item.requiredEvidenceRefs.length > 0) && proposal.approvalRequirements.length > 0
        ? [{ kind: "step_output" as const, id: stepId }] : [];
    });
    return { criterionId: criterion.id, satisfied: evidence.length > 0,
      evidenceRefs: evidence.slice(0, 1),
      summary: evidence.length ? "Runtime verified a sourced proposal with explicit human checkpoints." :
        "No sourced architecture proposal with human checkpoints passed verification." };
  },
};

/** Founder-triggered controlled goal. All results pass through the real Manager/runtime and durable stores. */
export async function runControlledProof(input: { tenantId: string; actorId: string; client: SupabaseClient }) {
  const provider = new ProductionModelProvider(); // Refuse registration if the live provider is unavailable.
  const existing = await input.client.from("agent_runtime_executions").select("execution_id,status")
    .eq("tenant_id", input.tenantId).eq("product_key", "operationos")
    .eq("idempotency_key", controlledProofRun.idempotencyKey).maybeSingle();
  if (existing.error) throw new Error("Controlled proof execution preflight failed");
  if (existing.data) return { executionId: existing.data.execution_id as string, status: existing.data.status as string };
  const occurredAt = new Date().toISOString();
  const registration = await registerControlledProof({ tenantId: input.tenantId,
    model: provider.model, client: input.client, occurredAt });
  const manager = await createAuthoritativeManager({ tenantId: input.tenantId,
    persistence: registration.persist, writer: registration.writer,
    productContext: registration.productContext, managerProvider: provider,
    specialistProvider: provider, workflowEvidence: [{ evidenceId: "controlled-brief-v1",
      sourceKind: "goal_input", sourceRef: { kind: "goal_input", id: "brief" },
      description: "Founder's supplied harmless internal workflow brief." }],
    verifier: controlledArchitectureVerifier, maxReplans: 0 });
  const agents = registration.agents;
  const result = await manager.run({ goal: {
    goalId: controlledProofRun.goalId, tenantId: input.tenantId,
    actorId: input.actorId,
    objective: "Discover a safe internal workflow for reviewing proposed agent responsibilities, then draft its agent architecture.",
    inputs: { brief: "An OperationOS operator receives an internal workflow proposal, checks its supporting evidence and human checkpoints, and drafts an architecture for review. No external action, deployment, configuration change, or permission grant is permitted. Intake volume and downstream tooling are unknown." },
    acceptanceCriteria: [{ id: "verified-proposal", description: "A runtime-verified, draft-only architecture proposal exists with explicit evidence and human checkpoints.",
      evaluator: "deterministic", required: true }],
    constraints: ["Draft only", "No external side effects", "No permission changes", "Founder retains final authority"],
    requestedAt: occurredAt, idempotencyKey: controlledProofRun.idempotencyKey,
  }, manifest: { managerVersionId: agents.find((agent) => agent.agentKey === "manager")!.versionId,
    specialistVersionIds: [agents.find((agent) => agent.agentKey === "workflow_discovery_specialist")!.versionId,
      agents.find((agent) => agent.agentKey === "agent_architecture_specialist")!.versionId],
    policyBundleVersionId: registration.policy.versionId, toolVersionIds: [],
    modelBindings: { manager: provider.model } },
  budget: { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 115_000, maxCostUsd: 1 } });
  const persisted = await input.client.from("agent_runtime_executions").select("execution_id")
    .eq("tenant_id", input.tenantId).eq("product_key", "operationos")
    .eq("idempotency_key", controlledProofRun.idempotencyKey).single();
  if (persisted.error || !persisted.data) throw new Error("Controlled proof execution is not durably readable");
  let observationId: string | undefined;
  if (result.status === "completed") {
    const attempts = await input.client.from("agent_runtime_execution_steps")
      .select("step_id,status,assignment").eq("tenant_id", input.tenantId)
      .eq("execution_id", persisted.data.execution_id);
    if (attempts.error) throw new Error("Controlled proof attempts are not durably readable");
    assertControlledAttempts(attempts.data);
    const signal = await input.client.from("agent_runtime_outcome_signals").select("signal_id")
      .eq("tenant_id", input.tenantId).eq("execution_id", persisted.data.execution_id)
      .eq("metric_key", "goal_success").single();
    if (signal.error || !signal.data) throw new Error("Verified goal outcome is not durably readable");
    observationId = `observation:${persisted.data.execution_id}`;
    await observeAuthoritativeGoal({ writer: registration.writer, tenantId: input.tenantId,
      productKey: "operationos", productVersionId: registration.productContext.product.versionId,
      productSnapshotId: registration.productContext.snapshot.productSnapshotId,
      executionId: persisted.data.execution_id, goalSignalId: signal.data.signal_id,
      capabilityKey: registration.productContext.capabilities[0]!.capabilityKey,
      evidenceId: `evidence:${persisted.data.execution_id}`, observationId,
      observedAt: new Date().toISOString(), client: input.client });
  }
  // Do not return raw model output to the HTTP client. The dashboard reads sanitized authoritative records.
  return { executionId: persisted.data.execution_id as string, status: result.status, observationId };
}
