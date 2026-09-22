import "server-only";

import { agentDefinitionSchema } from "./contracts";
import { dayTwoManagerAgentFixtures } from "./manager-fixtures";

const createdAt = "2026-09-22T00:00:00.000Z";
const modelPolicy = {
  allowedModelKeys: ["deterministic-fake"], temperatureMin: 0, temperatureMax: 0,
  maxOutputTokens: 8_000, timeoutMs: 60_000,
};

const manager = dayTwoManagerAgentFixtures.find((agent) => agent.agentKey === "manager");
if (!manager) throw new Error("Day 3 requires the verified Day 2 Manager definition");

export const dayThreeAgentFixtures = Object.freeze([
  manager,
  agentDefinitionSchema.parse({
    agentKey: "workflow_discovery_specialist", versionId: "workflow-discovery-day-three-v1", version: 1,
    role: "specialist", status: "active",
    purpose: "Convert bounded supplied evidence into a draft structured workflow model.",
    instructionTemplate: "Return only structured facts, assumptions, unknowns, evidence, and measurable workflow data. Never act externally.",
    inputSchema: "workflow-discovery-input-v1", outputSchema: "workflow-model-v1",
    modelPolicy, capabilityGrants: [], createdBy: "operationos", createdAt,
  }),
  agentDefinitionSchema.parse({
    agentKey: "agent_architecture_specialist", versionId: "agent-architecture-day-three-v1", version: 1,
    role: "specialist", status: "active",
    purpose: "Convert a runtime-verified workflow and registered product context into an agent-system proposal.",
    instructionTemplate: "Return a proposal only. Never grant permissions, deploy, change policy, or invent tools and capabilities.",
    inputSchema: "agent-architecture-input-v1", outputSchema: "agent-system-proposal-v1",
    modelPolicy, capabilityGrants: [], createdBy: "operationos", createdAt,
  }),
]);
