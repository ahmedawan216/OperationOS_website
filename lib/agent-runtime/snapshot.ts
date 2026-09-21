import "server-only";

import {
  executionSnapshotSchema,
  type AgentDefinition,
  type ExecutionSnapshot,
  type PolicyBundleVersion,
  type ToolDefinition,
} from "./contracts";
import type { ImmutableVersionRegistry } from "./registry";

export interface ActiveVersionManifest {
  managerVersionId: string;
  specialistVersionIds: readonly [string, string];
  policyBundleVersionId: string;
  toolVersionIds: readonly string[];
  modelBindings: Readonly<Record<string, string>>;
}

export interface ExecutionBudget {
  maxSteps: number;
  maxRetriesPerStep: number;
  maxWallTimeMs: number;
  maxCostUsd?: number;
}

export interface SnapshotDependencies {
  agents: ImmutableVersionRegistry<AgentDefinition>;
  tools: ImmutableVersionRegistry<ToolDefinition>;
  policies: ImmutableVersionRegistry<PolicyBundleVersion>;
}

export function resolveExecutionSnapshot(input: {
  executionId: string;
  goalId: string;
  manifest: ActiveVersionManifest;
  budget: ExecutionBudget;
  dependencies: SnapshotDependencies;
  createdAt: string;
}): ExecutionSnapshot {
  const manager = input.dependencies.agents.requireByVersionId(input.manifest.managerVersionId);
  const specialists = input.manifest.specialistVersionIds.map((versionId) =>
    input.dependencies.agents.requireByVersionId(versionId),
  );
  const policy = input.dependencies.policies.requireByVersionId(input.manifest.policyBundleVersionId);
  const tools = input.manifest.toolVersionIds.map((versionId) =>
    input.dependencies.tools.requireByVersionId(versionId),
  );

  if (manager.role !== "manager" || manager.status !== "active") {
    throw new Error("The manager deployment must reference an active manager definition");
  }

  for (const specialist of specialists) {
    if (specialist.role !== "specialist" || specialist.status !== "active") {
      throw new Error("Specialist deployments must reference active specialist definitions");
    }
  }

  if (policy.status !== "active") {
    throw new Error("The deployment must reference an active policy bundle");
  }

  for (const tool of tools) {
    if (!tool.versionId) {
      throw new Error("The deployment contains an invalid tool version");
    }
  }

  const modelBindings = Object.fromEntries(
    Object.entries(input.manifest.modelBindings).sort(([left], [right]) => left.localeCompare(right)),
  );
  const toolVersionIds = tools
    .map((tool) => tool.versionId)
    .sort((left, right) => left.localeCompare(right));

  return Object.freeze(
    executionSnapshotSchema.parse({
      executionId: input.executionId,
      goalId: input.goalId,
      managerVersionId: manager.versionId,
      specialistVersionIds: specialists.map((specialist) => specialist.versionId),
      policyBundleVersionId: policy.versionId,
      toolVersionIds,
      modelBindings,
      ...input.budget,
      createdAt: input.createdAt,
    }),
  );
}
