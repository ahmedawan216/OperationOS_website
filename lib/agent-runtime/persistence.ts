import "server-only";

import type {
  AgentDefinition,
  AgentAssignment,
  ApprovalRequest,
  OutcomeSignal,
  PolicyBundleVersion,
  ToolDefinition,
  TraceEvent,
} from "./contracts";
import type { ExecutionRecord } from "./execution-repository";
import type { StepAttemptRecord } from "./state";
import type { ExecutionStatus } from "./contracts";

/**
 * Server-side persistence boundary. Domain validation precedes every write;
 * database transition guards remain a second, independent authority.
 */
export interface AgentRuntimePersistence {
  loadAgentDefinitions(tenantId: string): Promise<readonly AgentDefinition[]>;
  loadToolDefinitions(tenantId: string): Promise<readonly ToolDefinition[]>;
  loadPolicyVersions(tenantId: string): Promise<readonly PolicyBundleVersion[]>;
  createOrGetExecution(record: ExecutionRecord): Promise<{ record: ExecutionRecord; created: boolean }>;
  transitionExecution(executionId: string, from: ExecutionStatus, to: ExecutionStatus, at: string): Promise<void>;
  persistStepAttempt(record: StepAttemptRecord): Promise<void>;
  persistAssignment(assignment: AgentAssignment, stepAttemptId: string, agentKey: string): Promise<void>;
  appendTrace(event: TraceEvent): Promise<void>;
  appendOutcome(signal: OutcomeSignal): Promise<void>;
  createApproval(request: ApprovalRequest): Promise<void>;
}
