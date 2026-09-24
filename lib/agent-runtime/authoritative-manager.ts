import "server-only";

import { randomUUID } from "node:crypto";
import type { AgentRuntimePersistence } from "./persistence";
import type { ManagerProvider } from "./manager-provider";
import type { SpecialistExecutor } from "./manager-execution";
import type { AcceptanceCriterionVerifier } from "./manager-verification";
import { ManagerExecutionLoop } from "./manager-execution";
import { ManagerFinalizer } from "./manager-verification";
import { ManagerOrchestrationService } from "./manager-service";
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
  specialistExecutor: SpecialistExecutor;
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
  const planning = new ManagerPlanningCoordinator({
    provider: input.managerProvider, agents: createAgentRegistry(agentDefinitions),
    history: new InMemoryPlanHistoryStore(), events, createPlanId: id,
    now: () => now().toISOString(), maxReplans: input.maxReplans, checkpoint,
  });
  const execution = new ManagerExecutionLoop({
    runtime, states, attempts, events, specialistExecutor: input.specialistExecutor,
    createStepAttemptId: id, now: () => now().toISOString(), nowMs: () => now().getTime(),
    isCancelled: input.isCancelled ?? (() => false), checkpoint,
    persistAssignment: (assignment, attemptId, agentKey) => input.persistence.persistAssignment(assignment, attemptId, agentKey),
  });
  const finalizer = new ManagerFinalizer({
    runtime, states, verifier: input.verifier, signals: new PersistedOutcomeSignalStore(journal),
    events, createSignalId: id, now: () => now().toISOString(), checkpoint,
  });
  return new ManagerOrchestrationService({ runtime, states, planning, execution, finalizer, nowMs: () => now().getTime(), checkpoint });
}
