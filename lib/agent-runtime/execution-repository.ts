import "server-only";

import type { ExecutionSnapshot, UserGoal } from "./contracts";

export interface ExecutionRecord {
  readonly executionId: string;
  readonly tenantId: string;
  readonly idempotencyKey: string;
  readonly goal: UserGoal;
  readonly snapshot: ExecutionSnapshot;
  readonly status: "queued";
  readonly createdAt: string;
}

export interface CreateExecutionResult {
  readonly record: ExecutionRecord;
  readonly created: boolean;
}

export interface ExecutionRepository {
  createOrGet(input: {
    goal: UserGoal;
    create: () => ExecutionRecord;
  }): CreateExecutionResult;
  getByExecutionId(executionId: string): ExecutionRecord | undefined;
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

export class InMemoryExecutionRepository implements ExecutionRepository {
  readonly #byExecutionId = new Map<string, ExecutionRecord>();
  readonly #byIdempotencyKey = new Map<string, string>();

  createOrGet(input: { goal: UserGoal; create: () => ExecutionRecord }): CreateExecutionResult {
    const key = `${input.goal.tenantId}:${input.goal.idempotencyKey}`;
    const existingId = this.#byIdempotencyKey.get(key);

    if (existingId) {
      const existing = this.#byExecutionId.get(existingId);
      if (!existing) throw new Error("Idempotency index references a missing execution");
      return { record: immutableCopy(existing), created: false };
    }

    const record = immutableCopy(input.create());
    if (record.tenantId !== input.goal.tenantId || record.idempotencyKey !== input.goal.idempotencyKey) {
      throw new Error("Execution identity does not match the submitted goal");
    }
    if (this.#byExecutionId.has(record.executionId)) {
      throw new Error(`Duplicate execution: ${record.executionId}`);
    }

    this.#byExecutionId.set(record.executionId, record);
    this.#byIdempotencyKey.set(key, record.executionId);
    return { record: immutableCopy(record), created: true };
  }

  getByExecutionId(executionId: string): ExecutionRecord | undefined {
    const record = this.#byExecutionId.get(executionId);
    return record ? immutableCopy(record) : undefined;
  }
}
