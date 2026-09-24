import "server-only";

import { runtimeErrorSchema, type RuntimeError, type UserGoal } from "./contracts";
import type { ManagerExecutionLoop, ManagerExecutionProgress } from "./manager-execution";
import type { ManagerFinalResult } from "./manager-contracts";
import type { ManagerPlanningCoordinator, ManagerPlanningOutcome } from "./manager-recovery";
import type { ManagerFinalizer } from "./manager-verification";
import type { ActiveVersionManifest, ExecutionBudget } from "./snapshot";
import type { AgentRuntimeService } from "./runtime";
import type { InMemoryExecutionStateStore } from "./state";

export type ManagerOrchestrationResult =
  | { readonly status: "completed"; readonly result: ManagerFinalResult }
  | { readonly status: "approval_required"; readonly approvalId: string; readonly stepId: string }
  | { readonly status: "cancelled" }
  | { readonly status: "failed"; readonly error: RuntimeError };

export class ManagerOrchestrationService {
  constructor(private readonly dependencies: {
    runtime: AgentRuntimeService;
    states: InMemoryExecutionStateStore;
    planning: ManagerPlanningCoordinator;
    execution: ManagerExecutionLoop;
    finalizer: ManagerFinalizer;
    nowMs: () => number;
    checkpoint?: () => Promise<void>;
  }) {}

  async run(input: {
    goal: UserGoal;
    manifest: ActiveVersionManifest;
    budget: ExecutionBudget;
  }): Promise<ManagerOrchestrationResult> {
    const startedAtMs = this.dependencies.nowMs();
    try {
      return await this.runBounded(input, startedAtMs);
    } finally {
      await this.dependencies.checkpoint?.();
    }
  }

  private async runBounded(input: { goal: UserGoal; manifest: ActiveVersionManifest; budget: ExecutionBudget }, startedAtMs: number): Promise<ManagerOrchestrationResult> {
    const created = this.dependencies.runtime.createGoalExecution(input);
    if (!created.created) {
      return { status: "failed", error: this.error("INTERNAL_ERROR", "Execution already exists for this idempotency key") };
    }
    const executionId = created.record.executionId;
    this.dependencies.runtime.transitionExecution(executionId, "planning");
    await this.dependencies.checkpoint?.();

    let planning = await this.dependencies.planning.createInitial({
      goal: input.goal,
      snapshot: created.record.snapshot,
    });
    if (planning.status === "failed") return this.fail(executionId, planning.error);

    let consumedSteps = 0;
    let carriedCostUsd = 0;
    let continuation = false;
    while (planning.status === "planned") {
      consumedSteps += planning.plan.orderedSteps.length;
      if (consumedSteps > created.record.snapshot.maxSteps) {
        return this.fail(executionId, this.error("BUDGET_EXCEEDED", "Manager exceeded the cumulative step budget"));
      }
      const planningCost = planning.usage?.costUsd ?? 0;
      const progress = await this.dependencies.execution.execute({
        goal: input.goal,
        validatedPlan: planning.plan,
        initialUsage: { costUsd: carriedCostUsd + planningCost },
        continuation,
        deferRetryableFailure: true,
        executionStartedAtMs: startedAtMs,
      });
      const terminal = await this.handleProgress(input.goal, planning, progress, startedAtMs);
      if (terminal) return terminal;

      if (progress.status !== "failed" || !progress.error.retryable) {
        return { status: "failed", error: progress.status === "failed" ? progress.error : this.error("INTERNAL_ERROR", "Unexpected Manager progress") };
      }
      carriedCostUsd = progress.costUsd;
      planning = await this.dependencies.planning.replan({
        goal: input.goal,
        snapshot: created.record.snapshot,
        failedStepId: planning.plan.orderedSteps.at(-1)?.step.stepId ?? "unknown-step",
        error: progress.error,
        evidenceRefs: [],
      });
      if (planning.status === "failed") return this.fail(executionId, planning.error);
      continuation = true;
    }
    return this.fail(executionId, this.error("INTERNAL_ERROR", "Manager planning ended unexpectedly"));
  }

  private async handleProgress(
    goal: UserGoal,
    planning: Extract<ManagerPlanningOutcome, { status: "planned" }>,
    progress: ManagerExecutionProgress,
    startedAtMs: number,
  ): Promise<ManagerOrchestrationResult | undefined> {
    if (progress.status === "ready_for_verification") {
      const result = await this.dependencies.finalizer.finalize({
        goal,
        plan: planning.plan,
        progress,
        durationMs: Math.max(0, this.dependencies.nowMs() - startedAtMs),
      });
      return { status: "completed", result };
    }
    if (progress.status === "approval_required") {
      return { status: "approval_required", approvalId: progress.approvalId, stepId: progress.stepId };
    }
    if (progress.status === "cancelled") return { status: "cancelled" };
    if (progress.status === "failed" && !progress.error.retryable) return { status: "failed", error: progress.error };
    return undefined;
  }

  private fail(executionId: string, error: RuntimeError): ManagerOrchestrationResult {
    const status = this.dependencies.states.get(executionId)?.status;
    if (status === "planning" || status === "running" || status === "awaiting_approval" || status === "verifying") {
      this.dependencies.runtime.transitionExecution(executionId, "failed");
    }
    return { status: "failed", error };
  }

  private error(code: RuntimeError["code"], message: string): RuntimeError {
    return runtimeErrorSchema.parse({ code, message, retryable: false });
  }
}
