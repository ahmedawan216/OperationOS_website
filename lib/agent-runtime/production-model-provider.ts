import "server-only";

import { z } from "zod";
import { managerPlanProposalSchema, type ManagerPlanningRequest } from "./manager-contracts";
import type { ManagerProvider, ManagerProviderResponse } from "./manager-provider";
import { agentSystemProposalSchema, workflowModelSchema,
  type AgentArchitectureInput, type WorkflowDiscoveryInput } from "./specialist-contracts";
import type { SpecialistProvider, SpecialistProviderResponse } from "./specialist-provider";

/** Untrusted provider output crosses the existing strict Manager/specialist validators. */
export const CONTROLLED_GROQ_MODEL = "openai/gpt-oss-20b";
/** Registry model keys intentionally use the existing contract-safe identifier format. */
export const CONTROLLED_GROQ_MODEL_KEY = "groq_gpt_oss_20b";

export class ProductionModelProvider implements ManagerProvider, SpecialistProvider {
  private readonly key: string;
  readonly model = CONTROLLED_GROQ_MODEL_KEY;

  constructor(config: { key?: string; model?: string; provider?: string } = {}) {
    this.key = config.key ?? process.env.GROQ_API_KEY ?? "";
    if ((config.provider ?? process.env.OPERATIONOS_AGENT_PROVIDER) !== "groq" ||
      !this.key.trim() || (config.model ?? process.env.OPERATIONOS_AGENT_MODEL) !== CONTROLLED_GROQ_MODEL) {
      throw new Error("Production model provider is not configured");
    }
  }

  private async request(role: string, input: unknown, schema: z.ZodType): Promise<{ output: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: CONTROLLED_GROQ_MODEL, temperature: 0, max_completion_tokens: 4_000,
          reasoning_effort: "low", include_reasoning: false,
          messages: [
            { role: "system", content: `You are the OperationOS ${role}. Return one JSON object matching the supplied schema. Use only supplied IDs, evidence, and registered capabilities. No external actions. Only concise decision summaries; never hidden reasoning.` },
            { role: "user", content: JSON.stringify({ request: input }) },
          ], response_format: { type: "json_schema", json_schema: {
            name: "operationos_structured_proposal", strict: false, schema: z.toJSONSchema(schema),
          } } }),
      });
      if (!response.ok) throw new Error("provider unavailable");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("choices" in data) || !Array.isArray(data.choices)) {
        throw new Error("malformed provider response");
      }
      const choices = data.choices.filter((item): item is { finish_reason: string; message: { content: string } } =>
        Boolean(item && typeof item === "object" && "finish_reason" in item && item.finish_reason === "stop" &&
          "message" in item && item.message && typeof item.message === "object" &&
          "content" in item.message && typeof item.message.content === "string"));
      if (data.choices.length !== 1 || choices.length !== 1 || choices[0]!.message.content.length > 100_000) {
        throw new Error("unbounded provider output");
      }
      const rawUsage = "usage" in data && data.usage && typeof data.usage === "object" ? data.usage : null;
      const inputTokens = rawUsage && "prompt_tokens" in rawUsage ? rawUsage.prompt_tokens : undefined;
      const outputTokens = rawUsage && "completion_tokens" in rawUsage ? rawUsage.completion_tokens : undefined;
      const usage = Number.isSafeInteger(inputTokens) && Number.isSafeInteger(outputTokens) &&
        (inputTokens as number) >= 0 && (outputTokens as number) >= 0
        ? { inputTokens: inputTokens as number, outputTokens: outputTokens as number } : undefined;
      return { output: JSON.parse(choices[0]!.message.content) as unknown, ...(usage ? { usage } : {}) };
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
