import "server-only";

import type { AgentArchitectureInput, WorkflowDiscoveryInput } from "../specialist-contracts";
import type { SpecialistProvider, SpecialistProviderResponse } from "../specialist-provider";

export type FakeSpecialistProviderOutcome = { kind: "response"; response: SpecialistProviderResponse } | { kind: "error"; error: Error };

export class DeterministicSpecialistProvider implements SpecialistProvider {
  readonly workflowRequests: WorkflowDiscoveryInput[] = [];
  readonly architectureRequests: AgentArchitectureInput[] = [];
  readonly #workflow: FakeSpecialistProviderOutcome[];
  readonly #architecture: FakeSpecialistProviderOutcome[];

  constructor(input: { workflow?: readonly FakeSpecialistProviderOutcome[]; architecture?: readonly FakeSpecialistProviderOutcome[] }) {
    this.#workflow = [...(input.workflow ?? [])];
    this.#architecture = [...(input.architecture ?? [])];
  }

  async discoverWorkflow(input: WorkflowDiscoveryInput): Promise<SpecialistProviderResponse> {
    this.workflowRequests.push(structuredClone(input));
    return this.next(this.#workflow, "workflow");
  }

  async proposeArchitecture(input: AgentArchitectureInput): Promise<SpecialistProviderResponse> {
    this.architectureRequests.push(structuredClone(input));
    return this.next(this.#architecture, "architecture");
  }

  private next(queue: FakeSpecialistProviderOutcome[], operation: string): SpecialistProviderResponse {
    const outcome = queue.shift();
    if (!outcome) throw new Error(`No deterministic ${operation} outcome is queued`);
    if (outcome.kind === "error") throw outcome.error;
    return structuredClone(outcome.response);
  }
}
