import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agentDefinitionSchema, policyBundleVersionSchema } from "./contracts";
import { canonicalRecord } from "./canonical-record";
import { createProductRegistries, resolveProductSnapshot } from "./product-registry";
import { createToolRegistry } from "./registry";
import { productDefinitionSchema, productCapabilitySchema, productWorkflowMetadataSchema,
  outcomeSignalDefinitionSchema, productEvaluatorDefinitionSchema } from "./product-contracts";
import { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";
import { SupabaseAgentRuntimePersistence } from "./supabase-persistence";
import { CONTROLLED_GROQ_MODEL_KEY } from "./production-model-provider";

const createdAt = "2026-09-24T00:00:00.000Z";
const fields = { version: 1, status: "active" as const, createdBy: "operationos", createdAt };
const capability = productCapabilitySchema.parse({ ...fields,
  productKey: "operationos", capabilityKey: "operationos.internal.workflow.draft",
  versionId: "operationos-internal-workflow-draft-v1", description: "Draft a bounded internal workflow model without external action.",
  actionClass: "draft", riskLevel: "low", resourceScopes: ["tenant:operationos/internal/workflows/*"], toolVersionIds: [],
});
const workflow = productWorkflowMetadataSchema.parse({ ...fields,
  productKey: "operationos", workflowKey: "operationos.internal.workflow.discovery",
  versionId: "operationos-internal-workflow-v1", description: "Discover and review an internal workflow as a draft.",
  stageKeys: ["discover", "review"], capabilityKeys: [capability.capabilityKey], outcomeSignalKeys: ["goal_success"],
});
const signal = outcomeSignalDefinitionSchema.parse({ ...fields,
  productKey: "operationos", signalKey: "goal_success", versionId: "operationos-goal-success-v1",
  description: "Runtime-owned verified goal completion.", valueType: "boolean", unit: "boolean",
});
const evaluator = productEvaluatorDefinitionSchema.parse({ ...fields,
  productKey: "operationos", evaluatorKey: "operationos.goal_success.v1", versionId: "operationos-goal-evaluator-v1",
  description: "Verify a proposal from the actual architecture step output.",
  inputSchema: "agent-system-proposal-v1", outputSchema: "criterion-verification-v1", supportedSignalKeys: [signal.signalKey],
});
const product = productDefinitionSchema.parse({ ...fields, productKey: "operationos",
  versionId: "operationos-internal-product-v1", name: "OperationOS", description: "Internal, read-only workflow discovery and draft architecture.",
  featureVersionIds: [], capabilityVersionIds: [capability.versionId], workflowVersionIds: [workflow.versionId],
  signalDefinitionVersionIds: [signal.versionId], evaluatorDefinitionVersionIds: [evaluator.versionId], contextReferenceVersionIds: [],
});
export const controlledProduct = resolveProductSnapshot({ productSnapshotId: "operationos-internal-snapshot-v1",
  createdAt, manifest: { productVersionId: product.versionId, featureVersionIds: [],
    capabilityVersionIds: [capability.versionId], workflowVersionIds: [workflow.versionId], toolVersionIds: [],
    signalDefinitionVersionIds: [signal.versionId], evaluatorDefinitionVersionIds: [evaluator.versionId], contextReferenceVersionIds: [] },
  registries: createProductRegistries({ products: [product], capabilities: [capability], workflows: [workflow],
    signals: [signal], evaluators: [evaluator], contexts: [], features: [], tools: createToolRegistry([]) }) });

/** Versions are immutable; an altered live model receives a new version ID. */
export function controlledRuntimeDefinitions(model: string) {
  if (model !== CONTROLLED_GROQ_MODEL_KEY) {
    throw new Error("The configured Groq model must match the approved controlled proof model");
  }
  const modelVersion = createHash("sha256").update(model).digest("hex").slice(0, 12);
  const modelPolicy = { allowedModelKeys: [model], temperatureMin: 0, temperatureMax: 0,
    maxOutputTokens: 4_000, timeoutMs: 30_000 };
  const agents = [
    { agentKey: "manager", role: "manager", inputSchema: "manager-planning-request-v1", outputSchema: "manager-plan-proposal-v1",
      purpose: "Plan and delegate within runtime authority.", instructionTemplate: "Propose a bounded plan using only registered specialists." },
    { agentKey: "workflow_discovery_specialist", role: "specialist", inputSchema: "workflow-discovery-input-v1", outputSchema: "workflow-model-v1",
      purpose: "Draft a workflow from declared evidence.", instructionTemplate: "Return facts, assumptions and unknowns. Never act externally." },
    { agentKey: "agent_architecture_specialist", role: "specialist", inputSchema: "agent-architecture-input-v1", outputSchema: "agent-system-proposal-v1",
      purpose: "Propose bounded agent architecture.", instructionTemplate: "Proposal only. Never deploy, grant capabilities or alter policy." },
  ].map((entry) => agentDefinitionSchema.parse({ ...fields, ...entry,
    versionId: `operationos-${entry.agentKey}-v1-${modelVersion}`, modelPolicy, capabilityGrants: [] }));
  const policy = policyBundleVersionSchema.parse({ ...fields, policyKey: "operationos-internal-default",
    versionId: "operationos-internal-policy-v1", description: "Deny by default; human approval for medium/high risk.",
    defaultDecision: "deny", mediumRiskRequiresApproval: true, highRiskRequiresExplicitApproval: true });
  return { agents, policy };
}

/** Revalidates every committed version before proceeding; never writes presentation-only rows. */
export async function registerControlledProof(input: {
  tenantId: string; model: string; client: SupabaseClient; occurredAt: string;
}) {
  const { tenantId, client } = input;
  const persist = new SupabaseAgentRuntimePersistence(tenantId, "operationos", client);
  const writer = new AuthoritativeLifecycleWriter(tenantId, "operationos", client);
  const { agents, policy } = controlledRuntimeDefinitions(input.model);
  const existing = await client.from("agent_runtime_agent_definitions").select("definition")
    .eq("tenant_id", tenantId);
  const policies = await client.from("agent_runtime_policy_bundle_versions").select("definition")
    .eq("tenant_id", tenantId);
  const tools = await persist.loadToolDefinitions(tenantId);
  const source = await client.from("agent_runtime_lifecycle_records").select("record_kind,payload")
    .eq("tenant_id", tenantId).eq("product_key", "operationos")
    .eq("record_id", product.versionId).maybeSingle();
  if (existing.error || policies.error || source.error || tools.length ||
    existing.data?.some((row) => !agents.some((agent) => canonicalRecord(row.definition) === canonicalRecord(agent))) ||
    policies.data?.some((row) => canonicalRecord(row.definition) !== canonicalRecord(policy))) {
    throw new Error("Controlled runtime registry is unavailable or differs from its immutable manifest");
  }
  const payload = { product: controlledProduct.product, snapshot: controlledProduct.snapshot,
    features: controlledProduct.features, capabilities: controlledProduct.capabilities,
    workflows: controlledProduct.workflows, signals: controlledProduct.signals,
    evaluators: controlledProduct.evaluators, tools: controlledProduct.tools, contexts: controlledProduct.contexts };
  if (source.data && (source.data.record_kind !== "product" || canonicalRecord(source.data.payload) !== canonicalRecord(payload))) {
    throw new Error("Authoritative product registry differs from the immutable manifest");
  }
  for (const agent of agents) {
    if (existing.data?.some((row) => canonicalRecord(row.definition) === canonicalRecord(agent))) continue;
    const { error } = await client.from("agent_runtime_agent_definitions").insert({
      version_id: agent.versionId, tenant_id: tenantId, agent_key: agent.agentKey,
      version: agent.version, status: agent.status, definition: agent,
      created_by: agent.createdBy, created_at: agent.createdAt });
    if (error) throw new Error("Authoritative agent registration failed");
  }
  if (!policies.data?.length) {
    const { error } = await client.from("agent_runtime_policy_bundle_versions").insert({
      version_id: policy.versionId, tenant_id: tenantId, policy_key: policy.policyKey,
      version: policy.version, status: policy.status, definition: policy,
      created_by: policy.createdBy, created_at: policy.createdAt });
    if (error) throw new Error("Authoritative policy registration failed");
  }
  if (!source.data) {
    await writer.append({ kind: "product", recordId: product.versionId, payload, occurredAt: input.occurredAt });
    await writer.project({ sourceId: product.versionId, sourceKind: "product", occurredAt: input.occurredAt });
  }
  const verified = await Promise.all([persist.loadAgentDefinitions(tenantId), persist.loadPolicyVersions(tenantId),
    writer.requireSource(product.versionId, "product")]);
  if (verified[0].length !== 3 || verified[1].length !== 1 ||
    verified[0].some((agent) => !agents.some((item) => canonicalRecord(item) === canonicalRecord(agent))) ||
    canonicalRecord(verified[2].payload) !== canonicalRecord(payload)) {
    throw new Error("Authoritative registration did not verify against committed versions");
  }
  return { writer, persist, agents, policy, productContext: controlledProduct };
}
