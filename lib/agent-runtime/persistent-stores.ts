import "server-only";

import type { AgentRuntimePersistence } from "./persistence";
import type { ExecutionRecord } from "./execution-repository";
import { InMemoryExecutionRepository } from "./execution-repository";
import { InMemoryExecutionStateStore, InMemoryStepAttemptStore } from "./state";
import { InMemoryOutcomeSignalStore } from "./manager-verification";
import { SafeTraceWriter, type TraceWriterOptions } from "./trace";
import type { OutcomeSignal, UserGoal } from "./contracts";
import type { RuntimeEventDraft } from "./runtime";

/**
 * Ordered durable-write barrier for the existing synchronous domain stores.
 * All provider/specialist boundaries must await checkpoint() before execution.
 * A failed write poisons the journal; queued writes cannot continue.
 */
export class RuntimePersistenceJournal {
  private pending: Promise<void> = Promise.resolve();
  private failure: unknown;

  constructor(readonly persistence: AgentRuntimePersistence) {}

  enqueue(write: () => Promise<unknown>): void {
    this.pending = this.pending.then(async () => {
      if (this.failure) return;
      try { await write(); }
      catch (error) { this.failure = error; }
    });
  }

  async checkpoint(): Promise<void> {
    await this.pending;
    if (this.failure) throw new Error("Authoritative runtime persistence failed; execution stopped", { cause: this.failure });
  }
}

export class PersistedExecutionRepository extends InMemoryExecutionRepository {
  constructor(private readonly journal: RuntimePersistenceJournal) { super(); }

  override createOrGet(input: { goal: UserGoal; create: () => ExecutionRecord }) {
    const result = super.createOrGet(input);
    if (result.created) this.journal.enqueue(async () => {
      const persisted = await this.journal.persistence.createOrGetExecution(result.record);
      if (!persisted.created || persisted.record.executionId !== result.record.executionId) {
        throw new Error("The idempotency key already belongs to a durable execution");
      }
    });
    return result;
  }
}

export class PersistedExecutionStateStore extends InMemoryExecutionStateStore {
  constructor(private readonly journal: RuntimePersistenceJournal) { super(); }

  override transition(executionId: string, to: Parameters<InMemoryExecutionStateStore["transition"]>[1], at: string) {
    const from = this.get(executionId)?.status;
    const record = super.transition(executionId, to, at);
    if (!from) throw new Error("Unknown execution state");
    this.journal.enqueue(() => this.journal.persistence.transitionExecution(executionId, from, to, at));
    return record;
  }
}

export class PersistedStepAttemptStore extends InMemoryStepAttemptStore {
  constructor(private readonly journal: RuntimePersistenceJournal) { super(); }

  override createInitial(input: Parameters<InMemoryStepAttemptStore["createInitial"]>[0]) {
    const record = super.createInitial(input);
    this.journal.enqueue(() => this.journal.persistence.persistStepAttempt(record));
    return record;
  }

  override retry(input: Parameters<InMemoryStepAttemptStore["retry"]>[0]) {
    const record = super.retry(input);
    this.journal.enqueue(() => this.journal.persistence.persistStepAttempt(record));
    return record;
  }

  override transition(stepAttemptId: string, to: Parameters<InMemoryStepAttemptStore["transition"]>[1], at: string) {
    const record = super.transition(stepAttemptId, to, at);
    this.journal.enqueue(() => this.journal.persistence.persistStepAttempt(record));
    return record;
  }
}

export class PersistedTraceWriter extends SafeTraceWriter {
  constructor(options: TraceWriterOptions, private readonly journal: RuntimePersistenceJournal) { super(options); }

  override record(draft: RuntimeEventDraft): void {
    super.record(draft);
    const event = this.list(draft.executionId).at(-1);
    if (!event) throw new Error("Runtime trace was not recorded");
    this.journal.enqueue(() => this.journal.persistence.appendTrace(event));
  }
}

export class PersistedOutcomeSignalStore extends InMemoryOutcomeSignalStore {
  constructor(private readonly journal: RuntimePersistenceJournal) { super(); }

  override append(signal: OutcomeSignal) {
    const record = super.append(signal);
    this.journal.enqueue(() => this.journal.persistence.appendOutcome(record));
    return record;
  }
}
