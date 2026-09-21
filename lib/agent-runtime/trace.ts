import "server-only";

import { createHash } from "node:crypto";

import { traceEventSchema, type DataRef, type TraceEvent } from "./contracts";
import type { RuntimeEventDraft, RuntimeEventSink } from "./runtime";

const alwaysSensitiveKeys = new Set([
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "service_role_key",
]);

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
}

function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      alwaysSensitiveKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitiveKeys(child),
    ]),
  );
}

function redactPath(target: Record<string, unknown>, path: string): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return;
  let current: unknown = target;

  for (const segment of segments.slice(0, -1)) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return;
    current = (current as Record<string, unknown>)[segment];
  }

  const leaf = segments.at(-1)!;
  if (current && typeof current === "object" && !Array.isArray(current) && leaf in current) {
    (current as Record<string, unknown>)[leaf] = "[REDACTED]";
  }
}

export function sanitizeTracePayload(
  payload: Readonly<Record<string, unknown>>,
  configuredPaths: readonly string[],
): Record<string, unknown> {
  const sanitized = redactSensitiveKeys(structuredClone(payload)) as Record<string, unknown>;
  for (const path of configuredPaths) redactPath(sanitized, path);
  return sanitized;
}

export interface TraceArtifactStore {
  put(input: { executionId: string; content: Record<string, unknown>; digest: string }): DataRef;
}

export class InMemoryTraceArtifactStore implements TraceArtifactStore {
  readonly #artifacts = new Map<string, Record<string, unknown>>();

  put(input: { executionId: string; content: Record<string, unknown>; digest: string }): DataRef {
    const id = `${input.executionId}:${input.digest}`;
    this.#artifacts.set(id, immutableCopy(input.content));
    return Object.freeze({ kind: "artifact", id, digest: input.digest });
  }

  get(id: string): Record<string, unknown> | undefined {
    const artifact = this.#artifacts.get(id);
    return artifact ? immutableCopy(artifact) : undefined;
  }
}

export interface TraceWriterOptions {
  readonly maxPayloadBytes: number;
  readonly createEventId: () => string;
  readonly artifacts: TraceArtifactStore;
}

export class SafeTraceWriter implements RuntimeEventSink {
  readonly #eventsByExecution = new Map<string, TraceEvent[]>();

  constructor(private readonly options: TraceWriterOptions) {
    if (!Number.isInteger(options.maxPayloadBytes) || options.maxPayloadBytes < 128) {
      throw new Error("maxPayloadBytes must be an integer of at least 128 bytes");
    }
  }

  record(draft: RuntimeEventDraft): void {
    const events = this.#eventsByExecution.get(draft.executionId) ?? [];
    const sanitized = sanitizeTracePayload(draft.payload, draft.redactionPaths ?? []);
    const serialized = JSON.stringify(sanitized);
    const sizeBytes = Buffer.byteLength(serialized, "utf8");
    let payload: Record<string, unknown> = sanitized;

    if (sizeBytes > this.options.maxPayloadBytes) {
      const digest = `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
      const artifactRef = this.options.artifacts.put({
        executionId: draft.executionId,
        content: sanitized,
        digest,
      });
      payload = {
        bounded: true,
        originalSizeBytes: sizeBytes,
        artifactRef,
        digest,
      };
    }

    const event = traceEventSchema.parse({
      eventId: this.options.createEventId(),
      executionId: draft.executionId,
      sequence: events.length + 1,
      type: draft.type,
      occurredAt: draft.occurredAt,
      actor: draft.actor,
      versionRefs: draft.versionRefs,
      payload,
    });
    const frozen = immutableCopy(event);
    this.#eventsByExecution.set(draft.executionId, [...events, frozen]);
  }

  list(executionId: string): readonly TraceEvent[] {
    return (this.#eventsByExecution.get(executionId) ?? []).map(immutableCopy);
  }
}
