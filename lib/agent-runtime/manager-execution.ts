import "server-only";

import {
  agentResultSchema,
  runtimeErrorSchema,
  type AgentAssignment,
  type AgentDefinition,
  type AgentResult,
  type RuntimeError,
  type UserGoal,
} from "./contracts";
import type { ManagerProviderUsage } from "./manager-contracts";
import { createSpecialistAssignment, type ValidatedManagerPlan } from "./manager-planning";
import { managerProviderUsageSchema } from "./manager-contracts";
import type { RuntimeEventSink } from "./runtime";
import { AgentRuntimeService } from "./runtime";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "./state";
import { ContractValidationError, parseContract } from "./validation";

export interface SpecialistExecutionResponse {
  readonly result: unknown;
  readonly usage?: unknown;
}

export interface SpecialistExecutor {
  execute(input: {
    assignment: AgentAssignment;
    specialist: AgentDefinition;
  }): Promise<SpecialistExecutionResponse>;
}

export type ManagerExecutionProgress =
  | {
      readonly status: "ready_for_verification";
      readonly outputs: Readonly<Record<string, AgentResult>>;
      readonly costUsd: number;
    }
  | {
      readonly status: "approval_required";
      readonly approvalId: string;
      readonly stepId: string;
      readonly costUsd: number;
    }
  | { readonly status: "failed"; readonly error: RuntimeError; readonly costUsd: number }
  | { readonly status: "cancelled"; readonly costUsd: number };

export interface ManagerExecutionDependencies {
  readonly runtime: AgentRuntimeService;
  readonly states: InMemoryExecutionStateStore;
  readonly attempts: InMemoryStepAttemptStore;
  readonly events: RuntimeEventSink;
  readonly specialistExecutor: SpecialistExecutor;
  readonly createStepAttemptId: () => string;
  readonly now: () => string;
  readonly nowMs: () => number;
  readonly isCancelled: () => boolean;
}

function runtimeError(input: RuntimeError): RuntimeError {
  return runtimeErrorSchema.parse(input);
}

export function normalizeProviderError(error: unknown): RuntimeError {
  if (error instanceof ContractValidationError) return error.runtimeError;
  return runtimeError({
    code: "PROVIDER_ERROR",
    message: "A provider failed while executing a validated assignment",
    retryable: true,
    safeDetails: { providerErrorType: error instanceof Error ? error.name : "UnknownError" },
  });
}

function budgetError(kind: "steps" | "wall_time" | "cost", actual: number, limit: number): RuntimeError {
  return runtimeError({
    code: kind === "wall_time" ? "TIMEOUT" : "BUDGET_EXCEEDED",
    message: `Manager execution exceeded its ${kind.replace("_", " ")} budget`,
    retryable: false,
    safeDetails: { budget: kind, actual, limit },
  });
}

function usageCost(usage: ManagerProviderUsage | undefined): number {
  return usage?.costUsd ?? 0;
}

export class ManagerExecutionLoop {
  constructor(private readonly dependencies: ManagerExecutionDependencies) {}

  async execute(input: {
    goal: UserGoal;
    validatedPlan: ValidatedManagerPlan;
    initialUsage?: ManagerProviderUsage;
    continuation?: boolean;
    deferRetryableFailure?: boolean;
    executionStartedAtMs?: number;
  }): Promise<ManagerExecutionProgress> {
    const snapshot = input.validatedPlan.plan.executionId;
    const state = this.dependencies.states.get(snapshot);
    const expectedState = input.continuation ? "running" : "planning";
    if (!state || state.status !== expectedState) {
      throw new Error(`Manager execution may start only from the ${expectedState} state`);
    }

    const executionRecord = input.validatedPlan.orderedSteps[0]?.step;
    if (!executionRecord) throw new Error("Validated Manager plan contains no steps");
    const stepLimit = input.validatedPlan.orderedSteps.length;
    const runtimeSnapshot = input.validatedPlan.snapshot;
    if (stepLimit > runtimeSnapshot.maxSteps) {
      return this.fail(snapshot, budgetError("steps", stepLimit, runtimeSnapshot.maxSteps), usageCost(input.initialUsage));
    }

    const startedAtMs = input.executionStartedAtMs ?? this.dependencies.nowMs();
    let totalCostUsd = usageCost(input.initialUsage);
    const initialBudgetFailure = this.checkBudgets(runtimeSnapshot, startedAtMs, totalCostUsd);
    if (initialBudgetFailure) return this.fail(snapshot, initialBudgetFailure, totalCostUsd);

    if (!input.continuation) this.dependencies.runtime.transitionExecution(snapshot, "running");
    const outputs: Record<string, AgentResult> = {};

    for (const validatedStep of input.validatedPlan.orderedSteps) {
      if (this.dependencies.isCancelled()) return this.cancel(snapshot, totalCostUsd);
      const budgetFailure = this.checkBudgets(runtimeSnapshot, startedAtMs, totalCostUsd);
      if (budgetFailure) return this.fail(snapshot, budgetFailure, totalCostUsd);

      let attemptNumber = 1;
      let previousAttemptId: string | undefined;
      while (attemptNumber <= runtimeSnapshot.maxRetriesPerStep + 1) {
        if (this.dependencies.isCancelled()) return this.cancel(snapshot, totalCostUsd);
        const stepAttemptId = this.dependencies.createStepAttemptId();
        if (previousAttemptId) {
          this.dependencies.attempts.retry({
            failedStepAttemptId: previousAttemptId,
            newStepAttemptId: stepAttemptId,
            at: this.dependencies.now(),
          });
        } else {
          this.dependencies.attempts.createInitial({
            stepAttemptId,
            executionId: snapshot,
            stepId: validatedStep.step.stepId,
            at: this.dependencies.now(),
          });
        }
        this.dependencies.attempts.transition(stepAttemptId, "running", this.dependencies.now());
        const assignment = createSpecialistAssignment({
          executionId: snapshot,
          validatedStep,
          attempt: attemptNumber,
          goalConstraints: input.goal.constraints,
          deadlineAt: new Date(startedAtMs + runtimeSnapshot.maxWallTimeMs).toISOString(),
        });
        this.record("step.started", snapshot, {
          stepId: assignment.stepId,
          attempt: attemptNumber,
          assignedAgentKey: validatedStep.specialist.agentKey,
        });

        let result: AgentResult;
        let responseUsage: ManagerProviderUsage | undefined;
        try {
          const response = await this.dependencies.specialistExecutor.execute({
            assignment,
            specialist: validatedStep.specialist,
          });
          result = parseContract(agentResultSchema, response.result, "manager.specialist.result");
          if (result.executionId !== assignment.executionId || result.stepId !== assignment.stepId) {
            throw new ContractValidationError("manager.specialist.result.identity", [{
              path: ["executionId", "stepId"],
              message: "Specialist result identity must match its runtime assignment",
            }]);
          }
          responseUsage = response.usage === undefined
            ? undefined
            : parseContract(managerProviderUsageSchema, response.usage, "manager.specialist.usage");
        } catch (error) {
          result = {
            executionId: snapshot,
            stepId: assignment.stepId,
            status: "failed",
            evidenceRefs: [],
            unmetCriteria: validatedStep.step.acceptanceCriterionIds,
            error: normalizeProviderError(error),
          };
        }
        totalCostUsd += usageCost(responseUsage);
        const postCallBudgetFailure = this.checkBudgets(runtimeSnapshot, startedAtMs, totalCostUsd);

        if (result.status === "completed" && !postCallBudgetFailure) {
          this.dependencies.attempts.transition(stepAttemptId, "succeeded", this.dependencies.now());
          outputs[result.stepId] = structuredClone(result);
          this.record("step.completed", snapshot, { stepId: result.stepId, attempt: attemptNumber });
          break;
        }

        if (result.status === "blocked" && result.requestedApprovalId && !postCallBudgetFailure) {
          this.dependencies.attempts.transition(stepAttemptId, "blocked", this.dependencies.now());
          this.dependencies.events.record({
            type: "approval.requested",
            executionId: snapshot,
            actor: { kind: "runtime", id: "manager-runtime" },
            versionRefs: { specialist: validatedStep.specialist.versionId },
            payload: {
              approvalId: result.requestedApprovalId,
              stepId: result.stepId,
              attempt: attemptNumber,
            },
            occurredAt: this.dependencies.now(),
          });
          this.dependencies.runtime.transitionExecution(snapshot, "awaiting_approval");
          return {
            status: "approval_required",
            approvalId: result.requestedApprovalId,
            stepId: result.stepId,
            costUsd: totalCostUsd,
          };
        }

        this.dependencies.attempts.transition(stepAttemptId, "failed", this.dependencies.now());
        const error = postCallBudgetFailure ?? result.error ?? runtimeError({
          code: "VERIFICATION_FAILED",
          message: "Specialist did not complete the assignment",
          retryable: false,
        });
        this.record("step.failed", snapshot, {
          stepId: assignment.stepId,
          attempt: attemptNumber,
          errorCode: error.code,
        });
        if (!error.retryable || attemptNumber > runtimeSnapshot.maxRetriesPerStep) {
          return this.fail(snapshot, error, totalCostUsd, input.deferRetryableFailure === true && error.retryable);
        }
        previousAttemptId = stepAttemptId;
        attemptNumber += 1;
      }
    }

    this.dependencies.runtime.transitionExecution(snapshot, "verifying");
    return { status: "ready_for_verification", outputs, costUsd: totalCostUsd };
  }

  private checkBudgets(
    snapshot: { maxWallTimeMs: number; maxCostUsd?: number },
    startedAtMs: number,
    costUsd: number,
  ): RuntimeError | undefined {
    const elapsed = this.dependencies.nowMs() - startedAtMs;
    if (elapsed > snapshot.maxWallTimeMs) return budgetError("wall_time", elapsed, snapshot.maxWallTimeMs);
    if (snapshot.maxCostUsd !== undefined && costUsd > snapshot.maxCostUsd) {
      return budgetError("cost", costUsd, snapshot.maxCostUsd);
    }
    return undefined;
  }

  private record(type: "step.started" | "step.completed" | "step.failed", executionId: string, payload: Record<string, unknown>): void {
    this.dependencies.events.record({
      type,
      executionId,
      actor: { kind: "runtime", id: "manager-runtime" },
      versionRefs: {},
      payload,
      occurredAt: this.dependencies.now(),
    });
  }

  private fail(executionId: string, error: RuntimeError, costUsd: number, defer = false): ManagerExecutionProgress {
    if (defer) return { status: "failed", error, costUsd };
    const state = this.dependencies.states.get(executionId);
    if (state && state.status !== "failed" && state.status !== "cancelled" && state.status !== "succeeded") {
      this.dependencies.runtime.transitionExecution(executionId, "failed");
    }
    return { status: "failed", error, costUsd };
  }

  private cancel(executionId: string, costUsd: number): ManagerExecutionProgress {
    this.dependencies.runtime.transitionExecution(executionId, "cancelled");
    return { status: "cancelled", costUsd };
  }
}
