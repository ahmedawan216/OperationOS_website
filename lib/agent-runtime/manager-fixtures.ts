import "server-only";

import { agentDefinitionSchema } from "./contracts";

const createdAt = "2026-09-21T00:00:00.000Z";
const modelPolicy = {
  allowedModelKeys: ["deterministic-fake"],
  temperatureMin: 0,
  temperatureMax: 0,
  maxOutputTokens: 8_000,
  timeoutMs: 60_000,
};

export const dayTwoManagerAgentFixtures = Object.freeze([
  agentDefinitionSchema.parse({
    agentKey: "manager", versionId: "manager-day-two-v1", version: 1,
    role: "manager", status: "active", purpose: "Orchestrate bounded planning, delegation, recovery, and verification.",
    instructionTemplate: "Return only the structured Manager plan proposal. Do not claim permissions or hidden reasoning.",
    inputSchema: "manager-planning-request-v1", outputSchema: "manager-plan-proposal-v1",
    modelPolicy, capabilityGrants: [], createdBy: "operationos", createdAt,
  }),
  agentDefinitionSchema.parse({
    agentKey: "workflow_discovery_specialist", versionId: "workflow-discovery-day-two-v1", version: 1,
    role: "specialist", status: "active", purpose: "Deterministic Day 2 workflow-discovery stub.",
    instructionTemplate: "Test stub only. Real specialist intelligence begins on Day 3.",
    inputSchema: "agent-assignment-v1", outputSchema: "workflow-model-v1",
    modelPolicy, capabilityGrants: [], createdBy: "operationos", createdAt,
  }),
  agentDefinitionSchema.parse({
    agentKey: "agent_architecture_specialist", versionId: "agent-architecture-day-two-v1", version: 1,
    role: "specialist", status: "active", purpose: "Deterministic Day 2 agent-architecture stub.",
    instructionTemplate: "Test stub only. Real specialist intelligence begins on Day 3.",
    inputSchema: "agent-assignment-v1", outputSchema: "agent-architecture-v1",
    modelPolicy, capabilityGrants: [], createdBy: "operationos", createdAt,
  }),
]);
