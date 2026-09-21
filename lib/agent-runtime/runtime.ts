import "server-only";

import {
  userGoalSchema,
  type ExecutionStatus,
  type TraceEventType,
  type UserGoal,
} from "./contracts";
import type { ExecutionRepository, ExecutionRecord } from "./execution-repository";
import {
  resolveExecutionSnapshot,
  type ActiveVersionManifest,
  type ExecutionBudget,
  type SnapshotDependencies,
} from "./snapshot";
import { assertExecutionTransition, InMemoryExecutionStateStore } from "./state";

export interface RuntimeEventDraft {
  readonly type: TraceEventType;
  readonly executionId: string;
  readonly actor: { readonly kind: "runtime"; readonly id: string };
  readonly versionRefs: Readonly<Record<string, string>>;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface RuntimeEventSink {
  record(event: RuntimeEventDraft): void;
}

export interface RuntimeServiceDependencies extends SnapshotDependencies {
  executions: ExecutionRepository;
  states: InMemoryExecutionStateStore;
  events: RuntimeEventSink;
  createExecutionId: () => string;
  now: () => string;
}

export class AgentRuntimeService {
  constructor(private readonly dependencies: RuntimeServiceDependencies) {}

  createGoalExecution(input: {
    goal: UserGoal;
    manifest: ActiveVersionManifest;
    budget: ExecutionBudget;
  }): { record: ExecutionRecord; created: boolean } {
    const goal = userGoalSchema.parse(input.goal);
    const result = this.dependencies.executions.createOrGet({
      goal,
      create: () => {
        const executionId = this.dependencies.createExecutionId();
        const createdAt = this.dependencies.now();
        const snapshot = resolveExecutionSnapshot({
          executionId,
          goalId: goal.goalId,
          manifest: input.manifest,
          budget: input.budget,
          dependencies: this.dependencies,
          createdAt,
        });
        return {
          executionId,
          tenantId: goal.tenantId,
          idempotencyKey: goal.idempotencyKey,
          goal,
          snapshot,
          status: "queued",
          createdAt,
        };
      },
    });

    if (result.created) {
      this.dependencies.states.initialize(result.record.executionId, result.record.createdAt);
      this.dependencies.events.record({
        type: "execution.created",
        executionId: result.record.executionId,
        actor: { kind: "runtime", id: "agent-runtime" },
        versionRefs: {
          manager: result.record.snapshot.managerVersionId,
          policy: result.record.snapshot.policyBundleVersionId,
        },
        payload: { goalId: goal.goalId, status: "queued" },
        occurredAt: result.record.createdAt,
      });
    }

    return result;
  }

  transitionExecution(executionId: string, to: ExecutionStatus): void {
    const current = this.dependencies.states.get(executionId);
    if (!current) throw new Error(`Unknown execution state: ${executionId}`);
    assertExecutionTransition(current.status, to);
    const at = this.dependencies.now();

    this.dependencies.events.record({
      type: "execution.state_changed",
      executionId,
      actor: { kind: "runtime", id: "agent-runtime" },
      versionRefs: {},
      payload: { from: current.status, to },
      occurredAt: at,
    });
    this.dependencies.states.transition(executionId, to, at);
  }
}
