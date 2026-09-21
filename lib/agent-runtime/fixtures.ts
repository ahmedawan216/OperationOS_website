import "server-only";

import {
  agentDefinitionSchema,
  policyBundleVersionSchema,
  toolDefinitionSchema,
} from "./contracts";

const createdAt = "2026-09-21T00:00:00.000Z";
const modelPolicy = {
  allowedModelKeys: ["unbound-model"],
  temperatureMin: 0,
  temperatureMax: 1,
  maxOutputTokens: 8_000,
  timeoutMs: 60_000,
};

export const dayOneAgentFixtures = Object.freeze([
  agentDefinitionSchema.parse({
    agentKey: "manager",
    versionId: "manager-day-one-v1",
    version: 1,
    role: "manager",
    status: "candidate",
    purpose: "Plan, delegate, recover, and verify without bypassing runtime policy.",
    instructionTemplate: "Candidate fixture only. No provider is bound on Day 1.",
    inputSchema: "user-goal-v1",
    outputSchema: "plan-v1",
    modelPolicy,
    capabilityGrants: [],
    createdBy: "operationos",
    createdAt,
  }),
  agentDefinitionSchema.parse({
    agentKey: "workflow_discovery_specialist",
    versionId: "workflow-discovery-day-one-v1",
    version: 1,
    role: "specialist",
    status: "candidate",
    purpose: "Convert supplied business evidence into a structured workflow model.",
    instructionTemplate: "Candidate fixture only. Read and draft; do not execute external actions.",
    inputSchema: "agent-assignment-v1",
    outputSchema: "workflow-model-v1",
    modelPolicy,
    capabilityGrants: [],
    createdBy: "operationos",
    createdAt,
  }),
  agentDefinitionSchema.parse({
    agentKey: "agent_architecture_specialist",
    versionId: "agent-architecture-day-one-v1",
    version: 1,
    role: "specialist",
    status: "candidate",
    purpose: "Convert an approved workflow model into a bounded agent-system proposal.",
    instructionTemplate: "Candidate fixture only. Propose architecture; do not deploy it.",
    inputSchema: "agent-assignment-v1",
    outputSchema: "agent-architecture-v1",
    modelPolicy,
    capabilityGrants: [],
    createdBy: "operationos",
    createdAt,
  }),
]);

export const dayOneToolFixtures = Object.freeze([
  toolDefinitionSchema.parse({
    toolKey: "workflow.source.read",
    versionId: "workflow-source-read-day-one-v1",
    description: "Read an explicitly supplied workflow source.",
    inputSchema: "data-ref-v1",
    outputSchema: "workflow-source-v1",
    sideEffect: "none",
    riskLevel: "low",
    requiredApproval: "none",
    redactionPaths: ["credentials", "authorization"],
    timeoutMs: 30_000,
    idempotent: true,
  }),
  toolDefinitionSchema.parse({
    toolKey: "consequential.external.execute",
    versionId: "consequential-external-day-one-v1",
    description: "Blocked Day 1 fixture representing a consequential external action.",
    inputSchema: "blocked-action-v1",
    outputSchema: "blocked-action-result-v1",
    sideEffect: "external_write",
    riskLevel: "high",
    requiredApproval: "explicit_human",
    redactionPaths: ["credentials", "authorization", "payload.secret"],
    timeoutMs: 30_000,
    idempotent: false,
  }),
]);

export const dayOnePolicyFixture = policyBundleVersionSchema.parse({
  policyKey: "operationos-default",
  versionId: "operationos-policy-day-one-v1",
  version: 1,
  status: "active",
  description: "Deny by default; require human approval for medium and explicit approval for high risk.",
  defaultDecision: "deny",
  mediumRiskRequiresApproval: true,
  highRiskRequiresExplicitApproval: true,
  createdBy: "operationos",
  createdAt,
});
