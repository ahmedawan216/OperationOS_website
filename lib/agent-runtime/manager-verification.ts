import "server-only";

import {
  outcomeSignalSchema,
  runtimeErrorSchema,
  type AcceptanceCriterion,
  type AgentResult,
  type DataRef,
  type OutcomeSignal,
  type UserGoal,
} from "./contracts";
import type { ManagerExecutionProgress } from "./manager-execution";
import {
  criterionVerificationSchema,
  managerFinalResultSchema,
  managerVerificationReportSchema,
  type CriterionVerification,
  type ManagerFinalResult,
} from "./manager-contracts";
import type { ValidatedManagerPlan } from "./manager-planning";
import type { RuntimeEventSink } from "./runtime";
import { AgentRuntimeService } from "./runtime";
import type { InMemoryExecutionStateStore } from "./state";
import { parseContract } from "./validation";

export interface AcceptanceCriterionVerifier {
  readonly versionId: string;
  verify(input: {
    criterion: AcceptanceCriterion;
    outputs: Readonly<Record<string, AgentResult>>;
    verificationStepIds: readonly string[];
  }): Promise<unknown>;
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

export class InMemoryOutcomeSignalStore {
  readonly #signals: OutcomeSignal[] = [];

  append(signal: OutcomeSignal): OutcomeSignal {
    const stored = immutableCopy(outcomeSignalSchema.parse(signal));
    this.#signals.push(stored);
    return immutableCopy(stored);
  }

  list(executionId: string): readonly OutcomeSignal[] {
    return this.#signals.filter((signal) => signal.executionId === executionId).map(immutableCopy);
  }
}

function refKey(ref: DataRef): string {
  return `${ref.kind}:${ref.id}:${ref.digest ?? ""}`;
}

function allowedEvidence(outputs: Readonly<Record<string, AgentResult>>): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const [stepId, result] of Object.entries(outputs)) {
    keys.add(refKey({ kind: "step_output", id: stepId }));
    for (const ref of result.evidenceRefs) keys.add(refKey(ref));
  }
  return keys;
}

export class ManagerFinalizer {
  constructor(private readonly dependencies: {
    runtime: AgentRuntimeService;
    states: InMemoryExecutionStateStore;
    verifier: AcceptanceCriterionVerifier;
    signals: InMemoryOutcomeSignalStore;
    events: RuntimeEventSink;
    createSignalId: () => string;
    now: () => string;
  }) {}

  async finalize(input: {
    goal: UserGoal;
    plan: ValidatedManagerPlan;
    progress: Extract<ManagerExecutionProgress, { status: "ready_for_verification" }>;
    durationMs: number;
  }): Promise<ManagerFinalResult> {
    const executionId = input.plan.snapshot.executionId;
    if (this.dependencies.states.get(executionId)?.status !== "verifying") {
      throw new Error("Manager finalization may run only in the verifying state");
    }
    const evidence = allowedEvidence(input.progress.outputs);
    const criteria: CriterionVerification[] = [];
    for (const criterion of input.goal.acceptanceCriteria) {
      const raw = await this.dependencies.verifier.verify({
        criterion,
        outputs: input.progress.outputs,
        verificationStepIds: input.plan.plan.verificationStepIds,
      });
      const verified = parseContract(criterionVerificationSchema, raw, "manager.verification.result");
      if (verified.criterionId !== criterion.id) {
        throw new Error("Verifier criterion identity does not match the runtime criterion");
      }
      if (verified.satisfied && verified.evidenceRefs.some((ref) => !evidence.has(refKey(ref)))) {
        criteria.push({ ...verified, satisfied: false, summary: "Verifier evidence was not produced by this execution." });
      } else {
        criteria.push(verified);
      }
    }

    const verification = managerVerificationReportSchema.parse({
      executionId,
      planId: input.plan.plan.planId,
      verifierVersionId: this.dependencies.verifier.versionId,
      criteria,
    });
    const failedRequired = input.goal.acceptanceCriteria.filter((criterion) =>
      criterion.required && !criteria.find((result) => result.criterionId === criterion.id)?.satisfied,
    );
    const succeeded = failedRequired.length === 0;
    const completedAt = this.dependencies.now();
    const error = succeeded ? undefined : runtimeErrorSchema.parse({
      code: "VERIFICATION_FAILED",
      message: "One or more required acceptance criteria were not verified",
      retryable: false,
      safeDetails: { failedCriterionIds: failedRequired.map((criterion) => criterion.id) },
    });

    this.dependencies.events.record({
      type: "verification.completed",
      executionId,
      actor: { kind: "runtime", id: "manager-verifier" },
      versionRefs: { verifier: this.dependencies.verifier.versionId },
      payload: {
        planId: input.plan.plan.planId,
        succeeded,
        criteria: criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          satisfied: criterion.satisfied,
          evidenceRefs: criterion.evidenceRefs,
          summary: criterion.summary,
        })),
      },
      occurredAt: completedAt,
    });

    this.recordSignal(executionId, "goal_success", succeeded ? 1 : 0, "boolean", completedAt);
    for (const criterion of criteria) {
      this.recordSignal(executionId, "criterion_score", criterion.satisfied ? 1 : 0, "ratio", completedAt);
    }
    this.recordSignal(executionId, "latency_ms", input.durationMs, "milliseconds", completedAt);
    this.recordSignal(executionId, "cost_usd", input.progress.costUsd, "usd", completedAt);
    this.dependencies.runtime.transitionExecution(executionId, succeeded ? "succeeded" : "failed");

    return managerFinalResultSchema.parse({
      executionId,
      goalId: input.goal.goalId,
      planId: input.plan.plan.planId,
      status: succeeded ? "succeeded" : "failed",
      outputs: input.progress.outputs,
      verification,
      error,
      costUsd: input.progress.costUsd,
      completedAt,
    });
  }

  private recordSignal(
    executionId: string,
    metricKey: OutcomeSignal["metricKey"],
    value: number,
    unit: string,
    recordedAt: string,
  ): void {
    const signal = this.dependencies.signals.append({
      signalId: this.dependencies.createSignalId(), executionId, metricKey, value, unit,
      source: "deterministic_evaluator", evaluatorVersionId: this.dependencies.verifier.versionId, recordedAt,
    });
    this.dependencies.events.record({
      type: "outcome.recorded",
      executionId,
      actor: { kind: "runtime", id: "manager-verifier" },
      versionRefs: { verifier: this.dependencies.verifier.versionId },
      payload: { signalId: signal.signalId, metricKey, value, unit },
      occurredAt: recordedAt,
    });
  }
}
