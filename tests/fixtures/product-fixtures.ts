import { toolDefinitionSchema } from "../../lib/agent-runtime/contracts";
import {
  outcomeSignalDefinitionSchema,
  productCapabilitySchema,
  productContextReferenceSchema,
  productDefinitionSchema,
  productEvaluatorDefinitionSchema,
  productFeatureSchema,
  productWorkflowMetadataSchema,
} from "../../lib/agent-runtime/product-contracts";
import { createProductRegistries } from "../../lib/agent-runtime/product-registry";
import { createToolRegistry } from "../../lib/agent-runtime/registry";

const createdAt = "2026-09-22T00:00:00.000Z";
const versionFields = { version: 1, status: "active" as const, createdBy: "operationos", createdAt };

export const productToolFixtures = Object.freeze([
  toolDefinitionSchema.parse({
    toolKey: "onboarding.record.read-tool", versionId: "onboarding-record-read-tool-v1",
    description: "Read an onboarding record from a declared tenant scope.",
    inputSchema: "onboarding-record-reference-v1", outputSchema: "onboarding-record-v1",
    sideEffect: "none", riskLevel: "low", requiredApproval: "none",
    redactionPaths: ["personalData"], timeoutMs: 10_000, idempotent: true,
  }),
  toolDefinitionSchema.parse({
    toolKey: "scorecard.draft.write-tool", versionId: "scorecard-draft-write-tool-v1",
    description: "Write a scorecard draft without publishing it.",
    inputSchema: "scorecard-draft-v1", outputSchema: "stored-scorecard-draft-v1",
    sideEffect: "internal_write", riskLevel: "medium", requiredApproval: "human",
    redactionPaths: ["candidateData"], timeoutMs: 10_000, idempotent: true,
  }),
]);

export const productCapabilityFixtures = Object.freeze([
  productCapabilitySchema.parse({
    ...versionFields, versionId: "onboarding-record-read-capability-v1",
    productKey: "operations-suite", featureKey: "onboarding",
    capabilityKey: "onboarding.record.read", description: "Read declared onboarding records.",
    actionClass: "read", riskLevel: "low", resourceScopes: ["tenant:{tenantId}/onboarding/*"],
    toolVersionIds: ["onboarding-record-read-tool-v1"],
  }),
  productCapabilitySchema.parse({
    ...versionFields, versionId: "scorecard-draft-write-capability-v1",
    productKey: "operations-suite", featureKey: "scorecards",
    capabilityKey: "scorecard.draft.write", description: "Create a scorecard draft.",
    actionClass: "internal_write", riskLevel: "medium", resourceScopes: ["tenant:{tenantId}/scorecards/*"],
    toolVersionIds: ["scorecard-draft-write-tool-v1"],
  }),
]);

export const productFeatureFixtures = Object.freeze([
  productFeatureSchema.parse({
    ...versionFields, versionId: "onboarding-feature-v1", productKey: "operations-suite",
    featureKey: "onboarding", name: "Onboarding", description: "Bounded onboarding workflow metadata.",
    capabilityVersionIds: ["onboarding-record-read-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"],
  }),
  productFeatureSchema.parse({
    ...versionFields, versionId: "scorecards-feature-v1", productKey: "operations-suite",
    featureKey: "scorecards", name: "Scorecards", description: "Draft-only scorecard metadata.",
    capabilityVersionIds: ["scorecard-draft-write-capability-v1"],
    workflowVersionIds: [], contextReferenceVersionIds: [],
  }),
]);

export const productWorkflowFixtures = Object.freeze([
  productWorkflowMetadataSchema.parse({
    ...versionFields, versionId: "onboarding-workflow-v1", productKey: "operations-suite",
    featureKey: "onboarding", workflowKey: "onboarding.review",
    description: "Review an onboarding record without taking consequential action.",
    stageKeys: ["review"], capabilityKeys: ["onboarding.record.read"],
    outcomeSignalKeys: ["onboarding.decision.exists"],
  }),
]);

export const productSignalFixtures = Object.freeze([
  outcomeSignalDefinitionSchema.parse({
    ...versionFields, versionId: "onboarding-completed-signal-v1", productKey: "operations-suite",
    featureKey: "onboarding", signalKey: "onboarding.decision.exists",
    description: "Whether a bounded onboarding review completed.", valueType: "boolean", unit: "boolean",
  }),
]);

export const productEvaluatorFixtures = Object.freeze([
  productEvaluatorDefinitionSchema.parse({
    ...versionFields, versionId: "onboarding-evaluator-v1", productKey: "operations-suite",
    evaluatorKey: "onboarding.evaluator.v1", description: "Deterministically checks workflow outputs.",
    inputSchema: "workflow-model-v1", outputSchema: "verification-result-v1",
    supportedSignalKeys: ["onboarding.decision.exists"],
  }),
]);

export const productContextFixtures = Object.freeze([
  productContextReferenceSchema.parse({
    ...versionFields, versionId: "onboarding-context-version-v1", productKey: "operations-suite",
    featureKey: "onboarding", contextRefId: "product-context-onboarding", kind: "workflow_metadata",
    description: "Versioned onboarding workflow metadata.", referenceUri: "product://operations-suite/onboarding/v1",
    digest: "sha256:onboarding-context-v1", sensitivity: "internal",
  }),
]);

export const productDefinitionFixtures = Object.freeze([
  productDefinitionSchema.parse({
    ...versionFields, versionId: "operations-suite-product-v1", productKey: "operations-suite",
    name: "Operations Suite", description: "Product-agnostic integration fixture.",
    featureVersionIds: ["onboarding-feature-v1"],
    capabilityVersionIds: ["onboarding-record-read-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"],
    signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
    evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"],
    contextReferenceVersionIds: ["onboarding-context-version-v1"],
  }),
  productDefinitionSchema.parse({
    ...versionFields, version: 2, versionId: "operations-suite-product-v2", productKey: "operations-suite",
    name: "Operations Suite", description: "Product fixture with an additionally registered scorecard feature.",
    featureVersionIds: ["onboarding-feature-v1", "scorecards-feature-v1"],
    capabilityVersionIds: ["onboarding-record-read-capability-v1", "scorecard-draft-write-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"],
    signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
    evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"],
    contextReferenceVersionIds: ["onboarding-context-version-v1"],
  }),
]);

export function productRegistries() {
  return createProductRegistries({
    products: productDefinitionFixtures, features: productFeatureFixtures,
    capabilities: productCapabilityFixtures, workflows: productWorkflowFixtures,
    signals: productSignalFixtures, evaluators: productEvaluatorFixtures,
    contexts: productContextFixtures, tools: createToolRegistry(productToolFixtures),
  });
}
