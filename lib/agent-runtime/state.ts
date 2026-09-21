import "server-only";

import type { ExecutionStatus, StepStatus } from "./contracts";

const terminalExecutionStatuses = new Set<ExecutionStatus>(["succeeded", "failed", "cancelled"]);
const terminalStepStatuses = new Set<StepStatus>(["succeeded", "failed", "blocked", "skipped", "cancelled"]);

const executionTransitions: Readonly<Record<ExecutionStatus, readonly ExecutionStatus[]>> = {
  queued: ["planning", "cancelled"],
  planning: ["running", "awaiting_approval", "failed", "cancelled"],
  running: ["awaiting_approval", "verifying", "failed", "cancelled"],
  awaiting_approval: ["running", "failed", "cancelled"],
  verifying: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

const stepTransitions: Readonly<Record<StepStatus, readonly StepStatus[]>> = {
  pending: ["running", "skipped", "cancelled"],
  running: ["succeeded", "failed", "blocked", "cancelled"],
  succeeded: [],
  failed: [],
  blocked: [],
  skipped: [],
  cancelled: [],
};

export function assertExecutionTransition(from: ExecutionStatus, to: ExecutionStatus): void {
  if (!executionTransitions[from].includes(to)) {
    throw new Error(`Illegal execution transition: ${from} -> ${to}`);
  }
}

export function assertStepTransition(from: StepStatus, to: StepStatus): void {
  if (!stepTransitions[from].includes(to)) {
    throw new Error(`Illegal step transition: ${from} -> ${to}`);
  }
}

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return terminalExecutionStatuses.has(status);
}

export function isTerminalStepStatus(status: StepStatus): boolean {
  return terminalStepStatuses.has(status);
}

export interface ExecutionStateRecord {
  readonly executionId: string;
  readonly status: ExecutionStatus;
  readonly updatedAt: string;
}

export class InMemoryExecutionStateStore {
  readonly #states = new Map<string, ExecutionStateRecord>();

  initialize(executionId: string, at: string): ExecutionStateRecord {
    if (this.#states.has(executionId)) throw new Error(`Execution state already exists: ${executionId}`);
    const record = Object.freeze({ executionId, status: "queued" as const, updatedAt: at });
    this.#states.set(executionId, record);
    return { ...record };
  }

  get(executionId: string): ExecutionStateRecord | undefined {
    const record = this.#states.get(executionId);
    return record ? { ...record } : undefined;
  }

  transition(executionId: string, to: ExecutionStatus, at: string): ExecutionStateRecord {
    const current = this.#states.get(executionId);
    if (!current) throw new Error(`Unknown execution state: ${executionId}`);
    assertExecutionTransition(current.status, to);
    const next = Object.freeze({ executionId, status: to, updatedAt: at });
    this.#states.set(executionId, next);
    return { ...next };
  }
}

export interface StepAttemptRecord {
  readonly stepAttemptId: string;
  readonly executionId: string;
  readonly stepId: string;
  readonly attempt: number;
  readonly retryOfStepAttemptId?: string;
  readonly status: StepStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class InMemoryStepAttemptStore {
  readonly #attempts = new Map<string, StepAttemptRecord>();
  readonly #attemptIdsByStep = new Map<string, string[]>();

  createInitial(input: {
    stepAttemptId: string;
    executionId: string;
    stepId: string;
    at: string;
  }): StepAttemptRecord {
    const key = `${input.executionId}:${input.stepId}`;
    if ((this.#attemptIdsByStep.get(key) ?? []).length > 0) {
      throw new Error(`Initial attempt already exists: ${key}`);
    }
    return this.#store({ ...input, attempt: 1, status: "pending", createdAt: input.at, updatedAt: input.at });
  }

  transition(stepAttemptId: string, to: StepStatus, at: string): StepAttemptRecord {
    const current = this.#attempts.get(stepAttemptId);
    if (!current) throw new Error(`Unknown step attempt: ${stepAttemptId}`);
    assertStepTransition(current.status, to);
    return this.#replace({ ...current, status: to, updatedAt: at });
  }

  retry(input: { failedStepAttemptId: string; newStepAttemptId: string; at: string }): StepAttemptRecord {
    const failed = this.#attempts.get(input.failedStepAttemptId);
    if (!failed) throw new Error(`Unknown step attempt: ${input.failedStepAttemptId}`);
    if (failed.status !== "failed") throw new Error("Only a failed step attempt may be retried");
    return this.#store({
      stepAttemptId: input.newStepAttemptId,
      executionId: failed.executionId,
      stepId: failed.stepId,
      attempt: failed.attempt + 1,
      retryOfStepAttemptId: failed.stepAttemptId,
      status: "pending",
      createdAt: input.at,
      updatedAt: input.at,
    });
  }

  get(stepAttemptId: string): StepAttemptRecord | undefined {
    const attempt = this.#attempts.get(stepAttemptId);
    return attempt ? { ...attempt } : undefined;
  }

  listForStep(executionId: string, stepId: string): readonly StepAttemptRecord[] {
    const ids = this.#attemptIdsByStep.get(`${executionId}:${stepId}`) ?? [];
    return ids.map((id) => ({ ...this.#attempts.get(id)! }));
  }

  #store(record: StepAttemptRecord): StepAttemptRecord {
    if (this.#attempts.has(record.stepAttemptId)) {
      throw new Error(`Duplicate step attempt: ${record.stepAttemptId}`);
    }
    const frozen = Object.freeze({ ...record });
    this.#attempts.set(frozen.stepAttemptId, frozen);
    const key = `${frozen.executionId}:${frozen.stepId}`;
    this.#attemptIdsByStep.set(key, [...(this.#attemptIdsByStep.get(key) ?? []), frozen.stepAttemptId]);
    return { ...frozen };
  }

  #replace(record: StepAttemptRecord): StepAttemptRecord {
    const frozen = Object.freeze({ ...record });
    this.#attempts.set(frozen.stepAttemptId, frozen);
    return { ...frozen };
  }
}
