import "server-only";

import { approvalRequestSchema, type ApprovalRequest } from "./contracts";

export interface ApprovalLedger {
  add(request: ApprovalRequest): ApprovalRequest;
  get(approvalId: string): ApprovalRequest | undefined;
  consume(input: { approvalId: string; actionDigest: string; actorId: string; consumedAt: string }): ApprovalRequest;
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

export class InMemoryApprovalLedger implements ApprovalLedger {
  readonly #requests = new Map<string, ApprovalRequest>();

  add(request: ApprovalRequest): ApprovalRequest {
    const parsed = approvalRequestSchema.parse(request);
    if (this.#requests.has(parsed.approvalId)) {
      throw new Error(`Duplicate approval: ${parsed.approvalId}`);
    }
    const stored = immutableCopy(parsed);
    this.#requests.set(stored.approvalId, stored);
    return immutableCopy(stored);
  }

  get(approvalId: string): ApprovalRequest | undefined {
    const request = this.#requests.get(approvalId);
    return request ? immutableCopy(request) : undefined;
  }

  consume(input: {
    approvalId: string;
    actionDigest: string;
    actorId: string;
    consumedAt: string;
  }): ApprovalRequest {
    const current = this.#requests.get(input.approvalId);
    if (!current) throw new Error("Approval does not exist");
    if (current.status !== "approved") throw new Error("Approval is not available for consumption");
    if (current.actionDigest !== input.actionDigest) throw new Error("Approval action digest mismatch");
    if (current.actorId !== input.actorId) throw new Error("Approval actor mismatch");
    if (Date.parse(current.expiresAt) <= Date.parse(input.consumedAt)) throw new Error("Approval has expired");

    const consumed = approvalRequestSchema.parse({
      ...current,
      status: "consumed",
      consumedAt: input.consumedAt,
    });
    this.#requests.set(input.approvalId, immutableCopy(consumed));
    return immutableCopy(consumed);
  }
}
