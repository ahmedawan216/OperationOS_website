import "server-only";

import { z } from "zod";
import { managerPlanProposalSchema, type ManagerPlanningRequest } from "./manager-contracts";
import type { ManagerProvider, ManagerProviderResponse } from "./manager-provider";
import { agentSystemProposalSchema, workflowModelSchema,
  type AgentArchitectureInput, type WorkflowDiscoveryInput } from "./specialist-contracts";
import type { SpecialistProvider, SpecialistProviderResponse } from "./specialist-provider";

/** Untrusted provider output crosses the existing strict Manager/specialist validators. */
export class ProductionModelProvider implements ManagerProvider, SpecialistProvider {
  private readonly key: string;
  readonly model: string;

  constructor(config: { key?: string; model?: string } = {}) {
    this.key = config.key ?? process.env.OPENAI_API_KEY ?? "";
    this.model = config.model ?? process.env.OPERATIONOS_AGENT_MODEL ?? "";
    if (!this.key || !/^[a-z][a-z0-9._-]{0,89}-20\d\d-\d\d-\d\d$/.test(this.model) ||
      this.model === "deterministic-fake") {
      throw new Error("Production model provider is not configured");
    }
  }

  private async request(role: string, input: unknown, schema: z.ZodType): Promise<{ output: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, temperature: 0, store: false, max_output_tokens: 4_000,
          input: [
            { role: "system", content: `You are the OperationOS ${role}. Return one JSON object matching the supplied schema. Use only supplied IDs, evidence, and registered capabilities. No external actions. Only concise decision summaries; never hidden reasoning.` },
            { role: "user", content: JSON.stringify({ schema: z.toJSONSchema(schema), request: input }) },
          ], text: { format: { type: "json_object" } } }),
      });
      if (!response.ok) throw new Error("provider unavailable");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("output" in data) || !Array.isArray(data.output)) {
        throw new Error("malformed provider response");
      }
      const outputs = data.output.flatMap((item) => item && typeof item === "object" &&
        "content" in item && Array.isArray(item.content) ? item.content : [])
        .filter((item): item is { type: string; text: string } => Boolean(item && typeof item === "object" &&
          "type" in item && item.type === "output_text" && "text" in item && typeof item.text === "string"));
      if (outputs.length !== 1 || outputs[0]!.text.length > 100_000) throw new Error("unbounded provider output");
      const rawUsage = "usage" in data && data.usage && typeof data.usage === "object" ? data.usage : null;
      const inputTokens = rawUsage && "input_tokens" in rawUsage ? rawUsage.input_tokens : undefined;
      const outputTokens = rawUsage && "output_tokens" in rawUsage ? rawUsage.output_tokens : undefined;
      const usage = Number.isSafeInteger(inputTokens) && Number.isSafeInteger(outputTokens) &&
        (inputTokens as number) >= 0 && (outputTokens as number) >= 0
        ? { inputTokens: inputTokens as number, outputTokens: outputTokens as number } : undefined;
      return { output: JSON.parse(outputs[0]!.text) as unknown, ...(usage ? { usage } : {}) };
    } catch {
      // Raw provider errors, response bodies, secrets and hidden reasoning never reach runtime traces.
      throw new Error("Production model provider unavailable or invalid");
    } finally {
      clearTimeout(timer);
    }
  }

  generatePlan(input: ManagerPlanningRequest): Promise<ManagerProviderResponse> {
    return this.request("Manager. Plan exactly two steps: workflow_discovery_specialist reading goal_input brief, followed by agent_architecture_specialist reading only that verified step_output. Assign the required acceptance criterion to the second step. Use the exact supplied planId and executionId", input, managerPlanProposalSchema);
  }

  discoverWorkflow(input: WorkflowDiscoveryInput): Promise<SpecialistProviderResponse> {
    return this.request("workflow discovery specialist. Produce a draft model with facts supported by declared evidence, explicit assumptions, and unknowns", input, workflowModelSchema);
  }

  proposeArchitecture(input: AgentArchitectureInput): Promise<SpecialistProviderResponse> {
    return this.request("agent architecture specialist. Produce a proposal only, using verified workflow and registered capability/tool references. Never deploy or grant permissions", input, agentSystemProposalSchema);
  }
}
