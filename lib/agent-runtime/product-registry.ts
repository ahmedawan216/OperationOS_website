import "server-only";

import type { ToolDefinition } from "./contracts";
import {
  outcomeSignalDefinitionSchema,
  productCapabilitySchema,
  productContextReferenceSchema,
  productDefinitionSchema,
  productEvaluatorDefinitionSchema,
  productFeatureSchema,
  productSnapshotSchema,
  productWorkflowMetadataSchema,
  type OutcomeSignalDefinition,
  type ProductCapability,
  type ProductContextReference,
  type ProductDefinition,
  type ProductEvaluatorDefinition,
  type ProductFeature,
  type ProductSnapshot,
  type ProductWorkflowMetadata,
} from "./product-contracts";
import { InMemoryImmutableVersionRegistry, type ImmutableVersionRegistry } from "./registry";

export interface ProductRegistries {
  products: ImmutableVersionRegistry<ProductDefinition>;
  features: ImmutableVersionRegistry<ProductFeature>;
  capabilities: ImmutableVersionRegistry<ProductCapability>;
  workflows: ImmutableVersionRegistry<ProductWorkflowMetadata>;
  signals: ImmutableVersionRegistry<OutcomeSignalDefinition>;
  evaluators: ImmutableVersionRegistry<ProductEvaluatorDefinition>;
  contexts: ImmutableVersionRegistry<ProductContextReference>;
  tools: ImmutableVersionRegistry<ToolDefinition>;
}

export interface ProductVersionManifest {
  productVersionId: string;
  featureVersionIds: readonly string[];
  capabilityVersionIds: readonly string[];
  workflowVersionIds: readonly string[];
  toolVersionIds: readonly string[];
  signalDefinitionVersionIds: readonly string[];
  evaluatorDefinitionVersionIds: readonly string[];
  contextReferenceVersionIds: readonly string[];
}

export interface ResolvedProductContext {
  readonly snapshot: ProductSnapshot;
  readonly product: ProductDefinition;
  readonly features: readonly ProductFeature[];
  readonly capabilities: readonly ProductCapability[];
  readonly workflows: readonly ProductWorkflowMetadata[];
  readonly tools: readonly ToolDefinition[];
  readonly signals: readonly OutcomeSignalDefinition[];
  readonly evaluators: readonly ProductEvaluatorDefinition[];
  readonly contexts: readonly ProductContextReference[];
}

export function createProductRegistries(input: {
  products: readonly ProductDefinition[];
  features: readonly ProductFeature[];
  capabilities: readonly ProductCapability[];
  workflows: readonly ProductWorkflowMetadata[];
  signals: readonly OutcomeSignalDefinition[];
  evaluators: readonly ProductEvaluatorDefinition[];
  contexts: readonly ProductContextReference[];
  tools: ImmutableVersionRegistry<ToolDefinition>;
}): ProductRegistries {
  return {
    products: new InMemoryImmutableVersionRegistry(productDefinitionSchema, input.products),
    features: new InMemoryImmutableVersionRegistry(productFeatureSchema, input.features),
    capabilities: new InMemoryImmutableVersionRegistry(productCapabilitySchema, input.capabilities),
    workflows: new InMemoryImmutableVersionRegistry(productWorkflowMetadataSchema, input.workflows),
    signals: new InMemoryImmutableVersionRegistry(outcomeSignalDefinitionSchema, input.signals),
    evaluators: new InMemoryImmutableVersionRegistry(productEvaluatorDefinitionSchema, input.evaluators),
    contexts: new InMemoryImmutableVersionRegistry(productContextReferenceSchema, input.contexts),
    tools: input.tools,
  };
}

function resolveVersions<T>(ids: readonly string[], registry: ImmutableVersionRegistry<T & { versionId: string }>): T[] {
  return [...ids].sort().map((id) => registry.requireByVersionId(id));
}

function requireProductKey(items: readonly { productKey: string }[], productKey: string, label: string): void {
  if (items.some((item) => item.productKey !== productKey)) throw new Error(`${label} belongs to another product`);
}

function requireListed(selected: readonly string[], registered: readonly string[], label: string): void {
  const allowed = new Set(registered);
  for (const id of selected) if (!allowed.has(id)) throw new Error(`${label} is not registered by the product version: ${id}`);
}

function requireUnique(selected: readonly string[], label: string): void {
  if (new Set(selected).size !== selected.length) throw new Error(`${label} version IDs must be unique`);
}

function requireSubset(required: readonly string[], selected: ReadonlySet<string>, label: string): void {
  for (const value of required) if (!selected.has(value)) throw new Error(`${label} is missing from the product snapshot: ${value}`);
}

export function resolveProductSnapshot(input: {
  productSnapshotId: string;
  manifest: ProductVersionManifest;
  registries: ProductRegistries;
  createdAt: string;
}): ResolvedProductContext {
  const product = input.registries.products.requireByVersionId(input.manifest.productVersionId);
  if (product.status !== "active") throw new Error("Product version must be active");
  requireUnique(input.manifest.featureVersionIds, "Feature");
  requireUnique(input.manifest.capabilityVersionIds, "Capability");
  requireUnique(input.manifest.workflowVersionIds, "Workflow");
  requireUnique(input.manifest.toolVersionIds, "Tool");
  requireUnique(input.manifest.signalDefinitionVersionIds, "Signal");
  requireUnique(input.manifest.evaluatorDefinitionVersionIds, "Evaluator");
  requireUnique(input.manifest.contextReferenceVersionIds, "Context reference");
  requireListed(input.manifest.featureVersionIds, product.featureVersionIds, "Feature");
  requireListed(input.manifest.capabilityVersionIds, product.capabilityVersionIds, "Capability");
  requireListed(input.manifest.workflowVersionIds, product.workflowVersionIds, "Workflow");
  requireListed(input.manifest.signalDefinitionVersionIds, product.signalDefinitionVersionIds, "Signal");
  requireListed(input.manifest.evaluatorDefinitionVersionIds, product.evaluatorDefinitionVersionIds, "Evaluator");
  requireListed(input.manifest.contextReferenceVersionIds, product.contextReferenceVersionIds, "Context reference");

  const features = resolveVersions(input.manifest.featureVersionIds, input.registries.features);
  const capabilities = resolveVersions(input.manifest.capabilityVersionIds, input.registries.capabilities);
  const workflows = resolveVersions(input.manifest.workflowVersionIds, input.registries.workflows);
  const tools = resolveVersions(input.manifest.toolVersionIds, input.registries.tools);
  const signals = resolveVersions(input.manifest.signalDefinitionVersionIds, input.registries.signals);
  const evaluators = resolveVersions(input.manifest.evaluatorDefinitionVersionIds, input.registries.evaluators);
  const contexts = resolveVersions(input.manifest.contextReferenceVersionIds, input.registries.contexts);
  requireProductKey(features, product.productKey, "Feature");
  requireProductKey(capabilities, product.productKey, "Capability");
  requireProductKey(workflows, product.productKey, "Workflow");
  requireProductKey(signals, product.productKey, "Signal");
  requireProductKey(evaluators, product.productKey, "Evaluator");
  requireProductKey(contexts, product.productKey, "Context reference");
  for (const item of [...features, ...capabilities, ...workflows, ...signals, ...evaluators, ...contexts]) {
    if (item.status !== "active") throw new Error("Product snapshot may reference only active versions");
  }
  const selectedFeatureKeys = new Set(features.map((item) => item.featureKey));
  const selectedCapabilityVersions = new Set(capabilities.map((item) => item.versionId));
  const selectedCapabilityKeys = new Set(capabilities.map((item) => item.capabilityKey));
  const selectedWorkflowVersions = new Set(workflows.map((item) => item.versionId));
  const selectedSignalKeys = new Set(signals.map((item) => item.signalKey));
  const selectedContextVersions = new Set(contexts.map((item) => item.versionId));
  for (const feature of features) {
    requireSubset(feature.capabilityVersionIds, selectedCapabilityVersions, `Feature ${feature.featureKey} capability`);
    requireSubset(feature.workflowVersionIds, selectedWorkflowVersions, `Feature ${feature.featureKey} workflow`);
    requireSubset(feature.contextReferenceVersionIds, selectedContextVersions, `Feature ${feature.featureKey} context`);
  }
  for (const item of [...capabilities, ...workflows, ...signals, ...contexts]) {
    if (item.featureKey && !selectedFeatureKeys.has(item.featureKey)) {
      throw new Error(`Component references an unavailable feature: ${item.featureKey}`);
    }
  }
  for (const workflow of workflows) {
    requireSubset(workflow.capabilityKeys, selectedCapabilityKeys, `Workflow ${workflow.workflowKey} capability`);
    requireSubset(workflow.outcomeSignalKeys, selectedSignalKeys, `Workflow ${workflow.workflowKey} signal`);
  }
  for (const evaluator of evaluators) {
    requireSubset(evaluator.supportedSignalKeys, selectedSignalKeys, `Evaluator ${evaluator.evaluatorKey} signal`);
  }
  const selectedTools = new Set(input.manifest.toolVersionIds);
  const toolsByVersion = new Map(tools.map((item) => [item.versionId, item]));
  const riskRank = { low: 0, medium: 1, high: 2 } as const;
  for (const capability of capabilities) {
    for (const toolVersionId of capability.toolVersionIds) {
      if (!selectedTools.has(toolVersionId)) throw new Error(`Capability tool is missing from the product snapshot: ${toolVersionId}`);
      const tool = toolsByVersion.get(toolVersionId);
      if (!tool || riskRank[tool.riskLevel] < riskRank[capability.riskLevel]) {
        throw new Error(`Capability tool understates registered capability risk: ${toolVersionId}`);
      }
      const validSideEffects = capability.actionClass === "draft"
        ? new Set(["none", "internal_write"])
        : new Set([capability.actionClass === "read" ? "none" : capability.actionClass]);
      if (!validSideEffects.has(tool.sideEffect)) {
        throw new Error(`Capability tool side effect does not match the registered action class: ${toolVersionId}`);
      }
    }
  }

  const snapshot = productSnapshotSchema.parse({
    productSnapshotId: input.productSnapshotId,
    productVersionId: product.versionId,
    featureVersionIds: features.map((item) => item.versionId),
    capabilityVersionIds: capabilities.map((item) => item.versionId),
    workflowVersionIds: workflows.map((item) => item.versionId),
    toolVersionIds: tools.map((item) => item.versionId),
    signalDefinitionVersionIds: signals.map((item) => item.versionId),
    evaluatorDefinitionVersionIds: evaluators.map((item) => item.versionId),
    contextReferenceVersionIds: contexts.map((item) => item.versionId),
    createdAt: input.createdAt,
  });
  return Object.freeze({ snapshot, product, features, capabilities, workflows, tools, signals, evaluators, contexts });
}
