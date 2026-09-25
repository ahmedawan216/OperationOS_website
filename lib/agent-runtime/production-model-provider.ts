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

const flattenedManagerPlanKeys = Object.freeze([
  "planId", "executionId", "rationaleSummary", "steps", "verificationStepIds", "decisionSummary",
]);

/** Groq can apply the nested plan schema while flattening its outer response envelope. */
function normalizeManagerPlanOutput(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output) || "plan" in output) return output;
  const record = output as Record<string, unknown>;
  if (Object.keys(record).length !== flattenedManagerPlanKeys.length ||
    !flattenedManagerPlanKeys.every((key) => Object.hasOwn(record, key))) return output;
  const { decisionSummary, ...plan } = record;
  return { plan, decisionSummary };
}

function groqStrictSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(groqStrictSchema);
  if (!value || typeof value !== "object") return value;
  const schema = { ...(value as Record<string, unknown>) };
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const required = new Set(Array.isArray(schema.required) ? schema.required as string[] : []);
    const properties = Object.fromEntries(Object.entries(schema.properties as Record<string, unknown>)
      .map(([key, property]) => {
        const converted = groqStrictSchema(property);
        return [key, required.has(key) ? converted : { anyOf: [converted, { type: "null" }] }];
      }));
    schema.properties = properties;
    schema.required = Object.keys(properties);
  }
  if (schema.items) schema.items = groqStrictSchema(schema.items);
  for (const keyword of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(schema[keyword])) schema[keyword] = schema[keyword].map(groqStrictSchema);
  }
  return schema;
}

function removeNullProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNullProperties);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== null)
    .map(([key, child]) => [key, removeNullProperties(child)]));
}

function workflowProviderSchema(input: WorkflowDiscoveryInput): unknown {
  const schema = groqStrictSchema(z.toJSONSchema(workflowModelSchema)) as { properties?: Record<string, unknown> };
  if (!schema.properties) throw new Error("Workflow provider schema is unavailable");
  schema.properties.executionId = { const: input.assignment.executionId };
  schema.properties.stepId = { const: input.assignment.stepId };
  schema.properties.evidenceReferences = { const: input.evidence };
  return schema;
}

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

  private async request(role: string, input: unknown, schema: z.ZodType, options: {
    providerSchema?: unknown;
    strict?: boolean;
    normalizeNullableOptionals?: boolean;
  } = {}): Promise<{ output: unknown }> {
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
            name: "operationos_structured_proposal", strict: options.strict ?? false,
            schema: options.providerSchema ?? z.toJSONSchema(schema),
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
      const output = JSON.parse(choices[0]!.message.content) as unknown;
      return { output: options.normalizeNullableOptionals ? removeNullProperties(output) : output,
        ...(usage ? { usage } : {}) };
    } catch {
      // Raw provider errors, response bodies, secrets and hidden reasoning never reach runtime traces.
      throw new Error("Production model provider unavailable or invalid");
    } finally {
      clearTimeout(timer);
    }
  }

  async generatePlan(input: ManagerPlanningRequest): Promise<ManagerProviderResponse> {
    const response = await this.request(`Manager. Propose exactly two ordered steps within the immutable request snapshot.
Return only {plan, decisionSummary}; plan must contain planId, executionId, rationaleSummary, steps, verificationStepIds.
Copy planId and executionId exactly from the request. Give the two steps distinct stepId values and sequence 0 and 1.
Each step must contain stepId, sequence, objective, assignedAgentKey, inputRefs, expectedOutputSchema,
acceptanceCriterionIds, requiredCapabilities, riskLevel, dependsOn. Include every required field, even empty arrays.
Step 0: workflow_discovery_specialist; inputRefs exactly [{kind:"goal_input",id:"brief"}];
expectedOutputSchema "workflow-model-v1"; dependsOn [], acceptanceCriterionIds [], requiredCapabilities [], riskLevel "low".
Step 1: agent_architecture_specialist; inputRefs contains exactly one step_output whose id is the exact stepId you chose for step 0;
expectedOutputSchema "agent-system-proposal-v1"; dependsOn contains exactly that same step 0 stepId;
acceptanceCriterionIds contains only the required criterion ID from the goal; requiredCapabilities [], riskLevel "low".
Set verificationStepIds to an array containing exactly the stepId you chose for step 1. Never invent capabilities, references, criteria, or permissions.
Use concise decision and rationale summaries. No hidden reasoning or additional fields.`, input, managerPlanProposalSchema);
    return { ...response, output: normalizeManagerPlanOutput(response.output) };
  }

  discoverWorkflow(input: WorkflowDiscoveryInput): Promise<SpecialistProviderResponse> {
    return this.request(`workflow discovery specialist. Produce a draft model with facts supported by declared evidence, explicit assumptions, and unknowns.
Return every required workflow-model-v1 field. Copy contractVersion, executionId, and stepId exactly; status must be draft.
Copy evidenceReferences exactly from request.evidence with no added, removed, or modified field; never invent a digest.
Use only supplied evidenceId values in evidenceRefs, and give every stage at least one supplied evidence ID.
Use unique IDs. metricKey, detectableSignal, and capability keys must match ^[a-z][a-z0-9._-]*$.
Stage actorIds must reference actors; inputIds must reference only top-level inputs, never outputs; outputIds must reference top-level outputs.
Each stages array item must be the stage object itself, never an object keyed by stageId. Use [] when a later stage has no top-level input.
Stage dependencies, decisions, checkpoints, decision nextStageId values, failure stage IDs, and recovery actors must reference existing IDs.
Every decision needs at least two outcomes; omit nextStageId for a terminal outcome. Keep stage dependencies acyclic.
requiredCapabilityKeys may contain only request.declaredCapabilityKeys. Do not add fields or external actions.`, input,
    workflowModelSchema, { providerSchema: workflowProviderSchema(input), strict: true, normalizeNullableOptionals: true });
  }

  proposeArchitecture(input: AgentArchitectureInput): Promise<SpecialistProviderResponse> {
    return this.request("agent architecture specialist. Produce a proposal only, using verified workflow and registered capability/tool references. Never deploy or grant permissions", input, agentSystemProposalSchema);
  }
}
