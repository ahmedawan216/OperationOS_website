import "server-only";

import type { ApprovalLedger } from "./approvals";
import { runtimeErrorSchema, type AgentDefinition, type RuntimeError, type UserGoal } from "./contracts";
import { normalizeProviderError } from "./manager-execution";
import type { ManagerProvider } from "./manager-provider";
import { requestValidatedManagerPlan } from "./manager-provider";
import type { ManagerProviderUsage } from "./manager-contracts";
import { validateManagerPlan, type ValidatedManagerPlan } from "./manager-planning";
import type { ImmutableVersionRegistry } from "./registry";
import type { RuntimeEventSink } from "./runtime";
import { AgentRuntimeService } from "./runtime";
import type { InMemoryExecutionStateStore } from "./state";

export interface PlanHistoryRecord {
  readonly planId: string;
  readonly previousPlanId?: string;
  readonly kind: "initial" | "replan";
  readonly plan: ValidatedManagerPlan;
  readonly createdAt: string;
}

function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

export class InMemoryPlanHistoryStore {
  readonly #records = new Map<string, PlanHistoryRecord[]>();

  append(executionId: string, record: PlanHistoryRecord): PlanHistoryRecord {
    const history = this.#records.get(executionId) ?? [];
    if (history.some((entry) => entry.planId === record.planId)) {
      throw new Error(`Duplicate plan history record: ${record.planId}`);
    }
    const stored = immutableCopy(record);
    this.#records.set(executionId, [...history, stored]);
    return immutableCopy(stored);
  }

  list(executionId: string): readonly PlanHistoryRecord[] {
    return (this.#records.get(executionId) ?? []).map(immutableCopy);
  }
}

export type ManagerPlanningOutcome =
  | { readonly status: "planned"; readonly plan: ValidatedManagerPlan; readonly usage?: ManagerProviderUsage }
  | { readonly status: "failed"; readonly error: RuntimeError };

export class ManagerPlanningCoordinator {
  constructor(private readonly dependencies: {
    provider: ManagerProvider;
    agents: ImmutableVersionRegistry<AgentDefinition>;
    history: InMemoryPlanHistoryStore;
    events: RuntimeEventSink;
    createPlanId: () => string;
    now: () => string;
    maxReplans: number;
    checkpoint?: () => Promise<void>;
  }) {
    if (!Number.isInteger(dependencies.maxReplans) || dependencies.maxReplans < 0) {
      throw new Error("maxReplans must be a non-negative integer");
    }
  }

  async createInitial(input: { goal: UserGoal; snapshot: ValidatedManagerPlan["snapshot"] }): Promise<ManagerPlanningOutcome> {
    return this.requestPlan({ goal: input.goal, snapshot: input.snapshot, kind: "initial" });
  }

  async replan(input: {
    goal: UserGoal;
    snapshot: ValidatedManagerPlan["snapshot"];
    failedStepId: string;
    error: RuntimeError;
    evidenceRefs: readonly string[];
  }): Promise<ManagerPlanningOutcome> {
    const history = this.dependencies.history.list(input.snapshot.executionId);
    const replans = history.filter((record) => record.kind === "replan").length;
    if (replans >= this.dependencies.maxReplans) {
      return {
        status: "failed",
        error: runtimeErrorSchema.parse({
          code: "BUDGET_EXCEEDED",
          message: "Manager exceeded the replanning budget",
          retryable: false,
          safeDetails: { budget: "replans", actual: replans, limit: this.dependencies.maxReplans },
        }),
      };
    }
    return this.requestPlan({
      goal: input.goal,
      snapshot: input.snapshot,
      kind: "replan",
      failedStepId: input.failedStepId,
      error: input.error,
      evidenceRefs: input.evidenceRefs,
    });
  }

  private async requestPlan(input: {
    goal: UserGoal;
    snapshot: ValidatedManagerPlan["snapshot"];
    kind: "initial" | "replan";
    failedStepId?: string;
    error?: RuntimeError;
    evidenceRefs?: readonly string[];
  }): Promise<ManagerPlanningOutcome> {
    const history = this.dependencies.history.list(input.snapshot.executionId);
    const planId = this.dependencies.createPlanId();
    const request = {
      goal: input.goal,
      snapshot: input.snapshot,
      planId,
      previousPlanIds: history.map((record) => record.planId),
      recovery: input.failedStepId && input.error
        ? { failedStepId: input.failedStepId, error: input.error, evidenceRefs: [...(input.evidenceRefs ?? [])] }
        : undefined,
    };
    this.record("model.requested", input.snapshot.executionId, {
      operation: input.kind === "initial" ? "manager.plan" : "manager.replan",
      planId,
      previousPlanCount: history.length,
    });
    await this.dependencies.checkpoint?.();
    try {
      const response = await requestValidatedManagerPlan(this.dependencies.provider, request);
      let validated: ValidatedManagerPlan;
      try {
        validated = validateManagerPlan({ proposal: response.proposal, request, agents: this.dependencies.agents });
      } catch (error) {
        this.record("model.responded", input.snapshot.executionId, {
          operation: "manager.plan", planId, valid: false, errorCode: "VALIDATION_ERROR",
        });
        return {
          status: "failed",
          error: runtimeErrorSchema.parse({
            code: "VALIDATION_ERROR",
            message: "Manager plan was rejected by runtime validation",
            retryable: false,
            safeDetails: { reason: error instanceof Error ? error.message : "Unknown validation failure" },
          }),
        };
      }
      const priorStepIds = new Set(history.flatMap((record) => record.plan.plan.steps.map((step) => step.stepId)));
      if (input.kind === "replan" && validated.plan.steps.some((step) => priorStepIds.has(step.stepId))) {
        this.record("model.responded", input.snapshot.executionId, {
          operation: "manager.plan", planId, valid: false, errorCode: "VALIDATION_ERROR",
        });
        return {
          status: "failed",
          error: runtimeErrorSchema.parse({
            code: "VALIDATION_ERROR",
            message: "Replanned steps must preserve history by using new step IDs",
            retryable: false,
          }),
        };
      }
      this.dependencies.history.append(input.snapshot.executionId, {
        planId,
        previousPlanId: history.at(-1)?.planId,
        kind: input.kind,
        plan: validated,
        createdAt: this.dependencies.now(),
      });
      this.record("model.responded", input.snapshot.executionId, { operation: "manager.plan", planId, valid: true });
      this.record(input.kind === "initial" ? "plan.created" : "plan.revised", input.snapshot.executionId, {
        planId,
        previousPlanId: history.at(-1)?.planId,
        decisionSummary: response.proposal.decisionSummary,
      });
      return { status: "planned", plan: validated, usage: response.usage };
    } catch (error) {
      const normalized = normalizeProviderError(error);
      this.record("model.responded", input.snapshot.executionId, {
        operation: "manager.plan",
        planId,
        valid: false,
        errorCode: normalized.code,
      });
      return { status: "failed", error: normalized };
    }
  }

  private record(type: "model.requested" | "model.responded" | "plan.created" | "plan.revised", executionId: string, payload: Record<string, unknown>): void {
    this.dependencies.events.record({
      type,
      executionId,
      actor: { kind: "runtime", id: "manager-runtime" },
      versionRefs: {},
      payload,
      occurredAt: this.dependencies.now(),
    });
  }
}

export type ApprovalResumeOutcome =
  | { readonly status: "resumed" }
  | { readonly status: "blocked"; readonly error: RuntimeError };

export class ManagerApprovalGate {
  constructor(private readonly dependencies: {
    runtime: AgentRuntimeService;
    states: InMemoryExecutionStateStore;
    approvals: ApprovalLedger;
    events: RuntimeEventSink;
    now: () => string;
  }) {}

  resume(input: {
    executionId: string;
    approvalId: string;
    actorId: string;
    actionDigest: string;
  }): ApprovalResumeOutcome {
    const state = this.dependencies.states.get(input.executionId);
    if (!state || state.status !== "awaiting_approval") {
      return { status: "blocked", error: this.denied("Execution is not awaiting approval") };
    }
    const approval = this.dependencies.approvals.get(input.approvalId);
    if (!approval || approval.executionId !== input.executionId) {
      return { status: "blocked", error: this.denied("Approval is not bound to this execution") };
    }
    try {
      this.dependencies.approvals.consume({
        approvalId: input.approvalId,
        actorId: input.actorId,
        actionDigest: input.actionDigest,
        consumedAt: this.dependencies.now(),
      });
    } catch {
      return { status: "blocked", error: this.denied("Approval is invalid, expired, mismatched, or already consumed") };
    }
    this.dependencies.events.record({
      type: "approval.resolved",
      executionId: input.executionId,
      actor: { kind: "runtime", id: "manager-runtime" },
      versionRefs: {},
      payload: { approvalId: input.approvalId, status: "consumed" },
      occurredAt: this.dependencies.now(),
    });
    this.dependencies.runtime.transitionExecution(input.executionId, "running");
    return { status: "resumed" };
  }

  private denied(message: string): RuntimeError {
    return runtimeErrorSchema.parse({ code: "PERMISSION_DENIED", message, retryable: false });
  }
}
