import "server-only";

import type { ApprovalLedger } from "./approvals";
import type { AgentDefinition, ApprovalRequest, PolicyBundleVersion, ToolDefinition } from "./contracts";
import { decideAuthorization, type AuthorizationIntent, type PolicyDecision } from "./policy";
import type { RuntimeEventSink } from "./runtime";

export interface ToolRuntimeInput<T> {
  readonly executionId: string;
  readonly intent: AuthorizationIntent;
  readonly agent: AgentDefinition;
  readonly tool: ToolDefinition;
  readonly policy: PolicyBundleVersion;
  readonly approval?: ApprovalRequest;
  readonly approvals?: ApprovalLedger;
  readonly events: RuntimeEventSink;
  readonly now: () => string;
  readonly execute: () => Promise<T>;
}

export type ToolRuntimeResult<T> =
  | { readonly status: "completed"; readonly value: T; readonly decision: Extract<PolicyDecision, { decision: "allow" }> }
  | { readonly status: "blocked"; readonly decision: Exclude<PolicyDecision, { decision: "allow" }> };

export async function executeAuthorizedTool<T>(input: ToolRuntimeInput<T>): Promise<ToolRuntimeResult<T>> {
  const decision = decideAuthorization({
    intent: input.intent,
    agent: input.agent,
    tool: input.tool,
    policy: input.policy,
    approval: input.approval,
    now: input.now(),
  });
  const eventBase = {
    executionId: input.executionId,
    actor: { kind: "runtime" as const, id: "agent-runtime" },
    versionRefs: {
      agent: input.agent.versionId,
      tool: input.tool.versionId,
      policy: input.policy.versionId,
    },
    occurredAt: input.now(),
    redactionPaths: input.tool.redactionPaths,
  };

  input.events.record({
    ...eventBase,
    type: "tool.requested",
    payload: {
      toolKey: input.tool.toolKey,
      actionType: input.intent.actionType,
      actionDigest: decision.actionDigest,
      sideEffect: input.tool.sideEffect,
    },
  });

  if (decision.decision !== "allow") {
    input.events.record({
      ...eventBase,
      type: "tool.denied",
      payload: { decision: decision.decision, reason: decision.reason },
    });
    return { status: "blocked", decision };
  }

  if (decision.consumeApproval) {
    if (!decision.approvalId || !input.approvals) {
      throw new Error("Approved side effect requires an approval ledger");
    }
    input.approvals.consume({
      approvalId: decision.approvalId,
      actionDigest: decision.actionDigest,
      actorId: input.intent.actorId,
      consumedAt: input.now(),
    });
  }

  input.events.record({
    ...eventBase,
    type: "tool.authorized",
    payload: {
      toolKey: input.tool.toolKey,
      actionDigest: decision.actionDigest,
      approvalId: decision.approvalId,
    },
  });

  const value = await input.execute();
  input.events.record({
    ...eventBase,
    type: "tool.completed",
    payload: { toolKey: input.tool.toolKey, actionDigest: decision.actionDigest, succeeded: true },
  });
  return { status: "completed", value, decision };
}
