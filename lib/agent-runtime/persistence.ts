import "server-only";

import type {
  AgentDefinition,
  ApprovalRequest,
  OutcomeSignal,
  PolicyBundleVersion,
  ToolDefinition,
  TraceEvent,
} from "./contracts";
import type { ExecutionRecord } from "./execution-repository";
import type { StepAttemptRecord } from "./state";

/**
 * Persistence boundary for the production adapter. Day 1 supplies the secured
 * relational migration and verified in-memory adapters. A live Supabase adapter
 * is intentionally deferred until a database can be migrated and tested.
 */
export interface AgentRuntimePersistence {
  loadAgentDefinitions(tenantId: string): Promise<readonly AgentDefinition[]>;
  loadToolDefinitions(tenantId: string): Promise<readonly ToolDefinition[]>;
  loadPolicyVersions(tenantId: string): Promise<readonly PolicyBundleVersion[]>;
  createOrGetExecution(record: ExecutionRecord): Promise<{ record: ExecutionRecord; created: boolean }>;
  persistStepAttempt(record: StepAttemptRecord): Promise<void>;
  appendTrace(event: TraceEvent): Promise<void>;
  appendOutcome(signal: OutcomeSignal): Promise<void>;
  createApproval(request: ApprovalRequest): Promise<void>;
}
