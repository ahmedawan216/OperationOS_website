import "server-only";

import type { ZodType } from "zod";

import {
  agentDefinitionSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
  type AgentDefinition,
  type PolicyBundleVersion,
  type ToolDefinition,
} from "./contracts";

export interface ImmutableVersionRegistry<T> {
  getByVersionId(versionId: string): T | undefined;
  requireByVersionId(versionId: string): T;
  listVersions(): readonly T[];
}

function cloneAndFreeze<T>(value: T): T {
  const clone = structuredClone(value);

  if (clone && typeof clone === "object") {
    Object.freeze(clone);
    for (const child of Object.values(clone)) {
      if (child && typeof child === "object" && !Object.isFrozen(child)) {
        cloneAndFreezeInPlace(child);
      }
    }
  }

  return clone;
}

function cloneAndFreezeInPlace(value: object): void {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      cloneAndFreezeInPlace(child);
    }
  }
}

export class InMemoryImmutableVersionRegistry<T extends { versionId: string }>
  implements ImmutableVersionRegistry<T>
{
  readonly #versions: ReadonlyMap<string, T>;

  constructor(schema: ZodType<T>, versions: readonly T[]) {
    const parsed = versions.map((version) => cloneAndFreeze(schema.parse(version)));
    const byId = new Map<string, T>();

    for (const version of parsed) {
      if (byId.has(version.versionId)) {
        throw new Error(`Duplicate immutable version: ${version.versionId}`);
      }
      byId.set(version.versionId, version);
    }

    this.#versions = byId;
  }

  getByVersionId(versionId: string): T | undefined {
    const version = this.#versions.get(versionId);
    return version ? cloneAndFreeze(version) : undefined;
  }

  requireByVersionId(versionId: string): T {
    const version = this.getByVersionId(versionId);
    if (!version) {
      throw new Error(`Unknown immutable version: ${versionId}`);
    }
    return version;
  }

  listVersions(): readonly T[] {
    return [...this.#versions.values()]
      .sort((left, right) => left.versionId.localeCompare(right.versionId))
      .map(cloneAndFreeze);
  }
}

export function createAgentRegistry(versions: readonly AgentDefinition[]) {
  return new InMemoryImmutableVersionRegistry(agentDefinitionSchema, versions);
}

export function createToolRegistry(versions: readonly ToolDefinition[]) {
  return new InMemoryImmutableVersionRegistry(toolDefinitionSchema, versions);
}

export function createPolicyRegistry(versions: readonly PolicyBundleVersion[]) {
  return new InMemoryImmutableVersionRegistry(policyBundleVersionSchema, versions);
}
