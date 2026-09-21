import "server-only";

import type {
  ManagerProvider,
  ManagerProviderResponse,
} from "../manager-provider";
import type { ManagerPlanningRequest } from "../manager-contracts";

export type FakeManagerProviderOutcome =
  | { readonly kind: "response"; readonly response: ManagerProviderResponse }
  | { readonly kind: "error"; readonly error: Error };

export class DeterministicFakeManagerProvider implements ManagerProvider {
  readonly requests: ManagerPlanningRequest[] = [];
  readonly #outcomes: FakeManagerProviderOutcome[];

  constructor(outcomes: readonly FakeManagerProviderOutcome[]) {
    this.#outcomes = [...outcomes];
  }

  async generatePlan(request: ManagerPlanningRequest): Promise<ManagerProviderResponse> {
    this.requests.push(structuredClone(request));
    const outcome = this.#outcomes.shift();
    if (!outcome) throw new Error("Fake Manager provider has no queued outcome");
    if (outcome.kind === "error") throw outcome.error;
    return structuredClone(outcome.response);
  }
}
