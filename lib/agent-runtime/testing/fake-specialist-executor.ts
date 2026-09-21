import "server-only";

import type { AgentAssignment, AgentDefinition } from "../contracts";
import type { SpecialistExecutionResponse, SpecialistExecutor } from "../manager-execution";

export type FakeSpecialistOutcome =
  | { readonly kind: "response"; readonly response: SpecialistExecutionResponse }
  | { readonly kind: "error"; readonly error: Error };

export class DeterministicFakeSpecialistExecutor implements SpecialistExecutor {
  readonly calls: Array<{ assignment: AgentAssignment; specialist: AgentDefinition }> = [];
  readonly #outcomes: FakeSpecialistOutcome[];

  constructor(outcomes: readonly FakeSpecialistOutcome[]) {
    this.#outcomes = [...outcomes];
  }

  async execute(input: {
    assignment: AgentAssignment;
    specialist: AgentDefinition;
  }): Promise<SpecialistExecutionResponse> {
    this.calls.push(structuredClone(input));
    const outcome = this.#outcomes.shift();
    if (!outcome) throw new Error("Fake specialist executor has no queued outcome");
    if (outcome.kind === "error") throw outcome.error;
    return structuredClone(outcome.response);
  }
}
