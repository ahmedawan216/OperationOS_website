import "server-only";

import { createHash } from "node:crypto";

import type {
  AgentDefinition,
  ApprovalRequest,
  Environment,
  PolicyBundleVersion,
  RiskLevel,
  ToolDefinition,
} from "./contracts";

const riskRank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export interface AuthorizationIntent {
  readonly actorId: string;
  readonly tenantId: string;
  readonly capabilityKey: string;
  readonly resourceScope: string;
  readonly environment: Environment;
  readonly actionType: string;
  readonly actionPayload: unknown;
  readonly requestedRiskLevel?: RiskLevel;
}

export type PolicyDecision =
  | {
      decision: "allow";
      actionDigest: string;
      effectiveRiskLevel: RiskLevel;
      approvalId?: string;
      consumeApproval: boolean;
    }
  | {
      decision: "approval_required";
      actionDigest: string;
      effectiveRiskLevel: RiskLevel;
      approvalType: "human" | "explicit_human";
      reason: "MEDIUM_RISK" | "HIGH_RISK" | "TOOL_REQUIRES_APPROVAL";
    }
  | {
      decision: "deny";
      actionDigest: string;
      effectiveRiskLevel: RiskLevel;
      reason:
        | "AGENT_NOT_ACTIVE"
        | "POLICY_NOT_ACTIVE"
        | "CAPABILITY_NOT_GRANTED"
        | "TENANT_SCOPE_MISMATCH"
        | "RESOURCE_SCOPE_NOT_GRANTED"
        | "ENVIRONMENT_NOT_GRANTED"
        | "RISK_EXCEEDS_GRANT"
        | "APPROVAL_INVALID"
        | "APPROVAL_EXPIRED"
        | "APPROVAL_ACTOR_MISMATCH"
        | "APPROVAL_ACTION_MISMATCH"
        | "APPROVAL_TYPE_MISMATCH";
    };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function createActionDigest(intent: AuthorizationIntent, tool: ToolDefinition): string {
  const serialized = JSON.stringify(
    canonicalize({
      actorId: intent.actorId,
      tenantId: intent.tenantId,
      capabilityKey: intent.capabilityKey,
      resourceScope: intent.resourceScope,
      environment: intent.environment,
      actionType: intent.actionType,
      actionPayload: intent.actionPayload,
      toolKey: tool.toolKey,
      toolVersionId: tool.versionId,
    }),
  );
  return `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
}

function maximumRisk(left: RiskLevel, right: RiskLevel | undefined): RiskLevel {
  if (!right) return left;
  return riskRank[left] >= riskRank[right] ? left : right;
}

function requiredApproval(input: {
  riskLevel: RiskLevel;
  tool: ToolDefinition;
  policy: PolicyBundleVersion;
}): { type: "human" | "explicit_human"; reason: "MEDIUM_RISK" | "HIGH_RISK" | "TOOL_REQUIRES_APPROVAL" } | undefined {
  if (input.riskLevel === "high" && input.policy.highRiskRequiresExplicitApproval) {
    return { type: "explicit_human", reason: "HIGH_RISK" };
  }
  if (input.riskLevel === "medium" && input.policy.mediumRiskRequiresApproval) {
    return { type: "human", reason: "MEDIUM_RISK" };
  }
  if (input.tool.requiredApproval === "explicit_human") {
    return { type: "explicit_human", reason: "TOOL_REQUIRES_APPROVAL" };
  }
  if (input.tool.requiredApproval === "human") {
    return { type: "human", reason: "TOOL_REQUIRES_APPROVAL" };
  }
  return undefined;
}

export function decideAuthorization(input: {
  intent: AuthorizationIntent;
  agent: AgentDefinition;
  tool: ToolDefinition;
  policy: PolicyBundleVersion;
  approval?: ApprovalRequest;
  now: string;
}): PolicyDecision {
  const effectiveRiskLevel = maximumRisk(input.tool.riskLevel, input.intent.requestedRiskLevel);
  const actionDigest = createActionDigest(input.intent, input.tool);
  const deny = (reason: Extract<PolicyDecision, { decision: "deny" }>["reason"]): PolicyDecision => ({
    decision: "deny",
    actionDigest,
    effectiveRiskLevel,
    reason,
  });

  if (input.agent.status !== "active") return deny("AGENT_NOT_ACTIVE");
  if (input.policy.status !== "active" || input.policy.defaultDecision !== "deny") {
    return deny("POLICY_NOT_ACTIVE");
  }
  if (!input.intent.resourceScope.startsWith(`tenant:${input.intent.tenantId}/`)) {
    return deny("TENANT_SCOPE_MISMATCH");
  }

  const grants = input.agent.capabilityGrants.filter(
    (grant) => grant.capabilityKey === input.intent.capabilityKey,
  );
  if (grants.length === 0) return deny("CAPABILITY_NOT_GRANTED");

  const resourceGrants = grants.filter((grant) =>
    grant.resourceScopes.some(
      (scope) =>
        scope === input.intent.resourceScope ||
        (scope.endsWith("/*") && input.intent.resourceScope.startsWith(scope.slice(0, -1))),
    ),
  );
  if (resourceGrants.length === 0) return deny("RESOURCE_SCOPE_NOT_GRANTED");

  const environmentGrants = resourceGrants.filter((grant) =>
    grant.environments.includes(input.intent.environment),
  );
  if (environmentGrants.length === 0) return deny("ENVIRONMENT_NOT_GRANTED");
  if (!environmentGrants.some((grant) => riskRank[grant.maxRiskLevel] >= riskRank[effectiveRiskLevel])) {
    return deny("RISK_EXCEEDS_GRANT");
  }

  const requirement = requiredApproval({ riskLevel: effectiveRiskLevel, tool: input.tool, policy: input.policy });
  if (!requirement) {
    return { decision: "allow", actionDigest, effectiveRiskLevel, consumeApproval: false };
  }
  if (!input.approval) {
    return {
      decision: "approval_required",
      actionDigest,
      effectiveRiskLevel,
      approvalType: requirement.type,
      reason: requirement.reason,
    };
  }
  if (input.approval.status !== "approved") return deny("APPROVAL_INVALID");
  if (Date.parse(input.approval.expiresAt) <= Date.parse(input.now)) return deny("APPROVAL_EXPIRED");
  if (input.approval.actorId !== input.intent.actorId) return deny("APPROVAL_ACTOR_MISMATCH");
  if (input.approval.actionDigest !== actionDigest) return deny("APPROVAL_ACTION_MISMATCH");
  if (input.approval.approvalType !== requirement.type) return deny("APPROVAL_TYPE_MISMATCH");

  return {
    decision: "allow",
    actionDigest,
    effectiveRiskLevel,
    approvalId: input.approval.approvalId,
    consumeApproval: true,
  };
}
