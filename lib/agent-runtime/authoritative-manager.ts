import "server-only";

import { randomUUID } from "node:crypto";
import { canonicalRecord } from "./canonical-record";
import type { AgentRuntimePersistence } from "./persistence";
import type { ManagerProvider } from "./manager-provider";
import type { SpecialistExecutor } from "./manager-execution";
import type { AcceptanceCriterionVerifier } from "./manager-verification";
import { ManagerExecutionLoop } from "./manager-execution";
import { ManagerFinalizer } from "./manager-verification";
import { ManagerOrchestrationService } from "./manager-service";
import { WorkflowDiscoverySpecialist } from "./workflow-discovery-specialist";
import { AgentArchitectureSpecialist } from "./agent-architecture-specialist";
import { InMemorySpecialistContextStore } from "./specialist-context";
import { RegisteredWorkflowModelVerifier, SpecialistExecutionRouter } from "./specialist-router";
import { workflowEvidenceReferenceSchema, type WorkflowEvidenceReference } from "./specialist-contracts";
import type { SpecialistProvider } from "./specialist-provider";
import type { ResolvedProductContext } from "./product-registry";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";
import { InMemoryPlanHistoryStore, ManagerPlanningCoordinator } from "./manager-recovery";
import { createAgentRegistry, createPolicyRegistry, createToolRegistry } from "./registry";
import { AgentRuntimeService } from "./runtime";
import { InMemoryTraceArtifactStore } from "./trace";
import {
  RuntimePersistenceJournal, PersistedExecutionRepository, PersistedExecutionStateStore,
  PersistedStepAttemptStore, PersistedTraceWriter, PersistedOutcomeSignalStore,
} from "./persistent-stores";

/**
 * Server-only composition of the existing Manager/runtime with durable stores.
 * Production callers must supply an authorized, scoped persistence adapter and
 * approved providers; this factory never registers agents or grants capabilities.
 */
export async function createAuthoritativeManager(input: {
  tenantId: string;
  persistence: AgentRuntimePersistence;
  managerProvider: ManagerProvider;
  specialistExecutor?: SpecialistExecutor;
  specialistProvider?: SpecialistProvider;
  productContext?: ResolvedProductContext;
  workflowEvidence?: readonly WorkflowEvidenceReference[];
  writer?: AuthoritativeLifecycleWriter;
  verifier: AcceptanceCriterionVerifier;
  maxReplans: number;
  now?: () => Date;
  createId?: () => string;
  isCancelled?: () => boolean;
}) {
  const [agentDefinitions, toolDefinitions, policies] = await Promise.all([
    input.persistence.loadAgentDefinitions(input.tenantId),
    input.persistence.loadToolDefinitions(input.tenantId),
    input.persistence.loadPolicyVersions(input.tenantId),
  ]);
  if (!policies.length || !agentDefinitions.some((agent) => agent.agentKey === "manager" && agent.status === "active")) {
    throw new Error("Authoritative agent/policy registry is not configured");
  }
  const specialists = agentDefinitions.filter((agent) => agent.role === "specialist" && agent.status === "active");
  if (specialists.length !== 2 || !["workflow_discovery_specialist", "agent_architecture_specialist"]
    .every((key) => specialists.some((agent) => agent.agentKey === key))) {
    throw new Error("Exactly the two registered specialists are required");
  }
  const usingRealSpecialists = Boolean(input.specialistProvider);
  if (Boolean(input.specialistExecutor) === usingRealSpecialists ||
    (usingRealSpecialists && (!input.productContext || !input.writer || !input.workflowEvidence))) {
    throw new Error("Manager requires exactly one bounded specialist execution path");
  }
  if (usingRealSpecialists) {
    const context = input.productContext!;
    const source = (await input.writer!.requireSource(context.product.versionId, "product")).payload as Record<string, unknown>;
    if (canonicalRecord(source.product) !== canonicalRecord(context.product) ||
      canonicalRecord(source.snapshot) !== canonicalRecord(context.snapshot) ||
      (["features", "capabilities", "workflows", "signals", "evaluators", "tools", "contexts"] as const)
        .some((key) => canonicalRecord(source[key]) !== canonicalRecord(context[key]))) {
      throw new Error("Manager specialist product context must match the authoritative registered snapshot");
    }
  }
  const now = input.now ?? (() => new Date());
  const id = input.createId ?? randomUUID;
  const journal = new RuntimePersistenceJournal(input.persistence);
  const states = new PersistedExecutionStateStore(journal);
  const attempts = new PersistedStepAttemptStore(journal);
  const events = new PersistedTraceWriter({ maxPayloadBytes: 8_000, createEventId: id, artifacts: new InMemoryTraceArtifactStore() }, journal);
  const runtime = new AgentRuntimeService({
    agents: createAgentRegistry(agentDefinitions), tools: createToolRegistry(toolDefinitions),
    policies: createPolicyRegistry(policies), executions: new PersistedExecutionRepository(journal),
    states, events, createExecutionId: id, now: () => now().toISOString(),
  });
  const checkpoint = () => journal.checkpoint();
  const contexts = usingRealSpecialists ? new InMemorySpecialistContextStore() : undefined;
  const registeredExecutions = new Set<string>();
  const specialistExecutor = usingRealSpecialists ? new SpecialistExecutionRouter({
    workflow: new WorkflowDiscoverySpecialist({ provider: input.specialistProvider!, contexts: contexts!, events,
      now: () => now().toISOString() }),
    architecture: new AgentArchitectureSpecialist({ provider: input.specialistProvider!, contexts: contexts!, events,
      now: () => now().toISOString() }),
    contexts: contexts!,
    products: { resolveProductContext: (executionId) => {
      if (!registeredExecutions.has(executionId)) throw new Error("Execution has no bounded product context");
      return input.productContext!;
    } },
    workflowVerifier: new RegisteredWorkflowModelVerifier(), events,
    now: () => now().toISOString(),
  }) : input.specialistExecutor!;
  const planning = new ManagerPlanningCoordinator({
    provider: input.managerProvider, agents: createAgentRegistry(agentDefinitions),
    history: new InMemoryPlanHistoryStore(), events, createPlanId: id,
    now: () => now().toISOString(), maxReplans: input.maxReplans, checkpoint,
  });
  const execution = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor,
    createStepAttemptId: id, now: () => now().toISOString(), nowMs: () => now().getTime(),
    isCancelled: input.isCancelled ?? (() => false), checkpoint,
    persistAssignment: (assignment, attemptId, agentKey) => input.persistence.persistAssignment(assignment, attemptId, agentKey),
  });
  const finalizer = new ManagerFinalizer({
    runtime, states, verifier: input.verifier, signals: new PersistedOutcomeSignalStore(journal),
    events, createSignalId: id, now: () => now().toISOString(), checkpoint,
  });
  return new ManagerOrchestrationService({ runtime, states, planning, execution, finalizer,
    nowMs: () => now().getTime(), checkpoint,
    afterExecutionCreated: usingRealSpecialists ? ({ executionId, goal }) => {
      if (goal.tenantId !== input.tenantId) throw new Error("Specialist goal crosses its authoritative tenant");
      const evidence = input.workflowEvidence!.map((item) => workflowEvidenceReferenceSchema.parse(item));
      for (const item of evidence) {
        if (item.sourceKind !== "goal_input" || item.sourceRef.kind !== "goal_input" ||
          !(item.sourceRef.id in goal.inputs)) {
          throw new Error("Workflow evidence is not a declared bounded goal input");
        }
      }
      contexts!.registerWorkflowContext({ executionId,
        goal: { goalId: goal.goalId, objective: goal.objective }, evidence,
        declaredCapabilityKeys: input.productContext!.capabilities.map((item) => item.capabilityKey) });
      registeredExecutions.add(executionId);
    } : undefined });
}
