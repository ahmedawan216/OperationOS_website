import assert from "node:assert/strict";
import { test } from "node:test";

import { agentDefinitionSchema, type AgentAssignment } from "../lib/agent-runtime/contracts";
import { AgentArchitectureSpecialist } from "../lib/agent-runtime/agent-architecture-specialist";
import { resolveProductSnapshot } from "../lib/agent-runtime/product-registry";
import { InMemorySpecialistContextStore } from "../lib/agent-runtime/specialist-context";
import { DeterministicSpecialistProvider } from "../lib/agent-runtime/testing/fake-specialist-provider";
import { InMemoryTraceArtifactStore, SafeTraceWriter } from "../lib/agent-runtime/trace";
import { architectureInput, architectureProposal, workflowModel } from "./fixtures/specialist-fixtures";
import { productRegistries } from "./fixtures/product-fixtures";

const now = "2026-09-22T00:00:00.000Z";
const architectureAgent = agentDefinitionSchema.parse({
  agentKey: "agent_architecture_specialist", versionId: "architecture-specialist-day-three-v1", version: 1,
  role: "specialist", status: "active", purpose: "Propose bounded agent architecture.",
  instructionTemplate: "Return a proposal only; never deploy or modify runtime configuration.",
  inputSchema: "agent-architecture-input-v1", outputSchema: "agent-system-proposal-v1",
  modelPolicy: { allowedModelKeys: ["deterministic-fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 8_000, timeoutMs: 30_000 },
  capabilityGrants: [], createdBy: "operationos", createdAt: now,
});

function assignment(): AgentAssignment {
  return architectureInput().assignment;
}

function setup(output = architectureProposal()) {
  const registries = productRegistries();
  const productContext = resolveProductSnapshot({
    productSnapshotId: "product-snapshot-1",
    manifest: {
      productVersionId: "operations-suite-product-v1",
      featureVersionIds: ["onboarding-feature-v1"],
      capabilityVersionIds: ["onboarding-record-read-capability-v1"],
      workflowVersionIds: ["onboarding-workflow-v1"],
      toolVersionIds: ["onboarding-record-read-tool-v1"],
      signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
      evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"],
      contextReferenceVersionIds: ["onboarding-context-version-v1"],
    },
    registries,
    createdAt: now,
  });
  const contexts = new InMemorySpecialistContextStore();
  contexts.registerArchitectureContext({
    executionId: "execution-1",
    verifiedWorkflow: {
      model: workflowModel(), sourceRef: { kind: "step_output", id: "workflow-step" },
      verifierVersionId: "workflow-runtime-verifier-v1", verifiedAt: now,
    },
    productContext,
  });
  const provider = new DeterministicSpecialistProvider({
    architecture: [{ kind: "response", response: { output, usage: { costUsd: 0.02 } } }],
  });
  let eventId = 0;
  const events = new SafeTraceWriter({
    maxPayloadBytes: 4_000, createEventId: () => `architecture-event-${++eventId}`,
    artifacts: new InMemoryTraceArtifactStore(),
  });
  const executor = new AgentArchitectureSpecialist({ provider, contexts, events, now: () => now });
  return { executor, provider, events, registries, productContext };
}

test("architecture specialist consumes only verified workflow and immutable registered product context", async () => {
  const context = setup();
  const registryBefore = context.registries.products.listVersions();
  const response = await context.executor.execute({ assignment: assignment(), specialist: architectureAgent });
  const result = response.result as { status: string; output: ReturnType<typeof architectureProposal>; evidenceRefs: unknown[] };

  assert.equal(result.status, "completed");
  assert.equal(result.output.status, "proposal");
  assert.deepEqual(context.provider.architectureRequests[0]?.availableCapabilityKeys, ["onboarding.record.read"]);
  assert.deepEqual(context.provider.architectureRequests[0]?.availableToolKeys, ["onboarding.record.read-tool"]);
  assert.deepEqual(context.registries.products.listVersions(), registryBefore);
  assert.deepEqual(
    context.events.list("execution-1").map((event) => event.type),
    ["model.requested", "model.responded"],
  );
  assert.equal(JSON.stringify(context.events.list("execution-1")).includes("chain-of-thought"), false);
});

test("architecture specialist rejects unavailable capabilities and tools", async () => {
  const unknownCapability = structuredClone(architectureProposal());
  unknownCapability.agents[0]!.capabilityRequirements[0]!.capabilityKey = "unregistered.capability";
  await assert.rejects(
    setup(unknownCapability).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );

  const unknownTool = structuredClone(architectureProposal());
  unknownTool.agents[0]!.toolRequirements[0]!.toolKey = "unregistered.tool";
  await assert.rejects(
    setup(unknownTool).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );
});

test("architecture specialist rejects fabricated evidence and unrelated context boundaries", async () => {
  const fabricatedEvidence = structuredClone(architectureProposal());
  fabricatedEvidence.agents[0]!.capabilityRequirements[0]!.evidenceRefs = ["model-said-so"];
  await assert.rejects(
    setup(fabricatedEvidence).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );

  const leakedContext = structuredClone(architectureProposal());
  leakedContext.contextBoundaries[0]!.allowedReferenceIds.push("other-product-secret");
  await assert.rejects(
    setup(leakedContext).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );
});

test("architecture specialist rejects tool risk downgrades and invalid outcome evaluators", async () => {
  const downgraded = structuredClone(architectureProposal());
  downgraded.agents[0]!.toolRequirements[0]!.riskLevel = "medium";
  downgraded.agents[0]!.toolRequirements[0]!.approvalType = "human";
  await assert.rejects(
    setup(downgraded).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );

  const evaluator = structuredClone(architectureProposal());
  evaluator.outcomes[0]!.evaluatorRef = "unregistered.evaluator";
  await assert.rejects(
    setup(evaluator).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );
});

test("architecture assignment cannot introduce unrelated execution context", async () => {
  const context = setup();
  const invalidAssignment = {
    ...assignment(),
    contextRefs: [
      ...assignment().contextRefs,
      { kind: "goal_input" as const, id: "unrelated" },
    ],
  };
  await assert.rejects(
    context.executor.execute({ assignment: invalidAssignment, specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.context/,
  );
  assert.equal(context.provider.architectureRequests.length, 0);
});

test("architecture provider cannot change proposal identity or deploy status", async () => {
  const wrongIdentity = structuredClone(architectureProposal());
  wrongIdentity.executionId = "fabricated-execution";
  await assert.rejects(
    setup(wrongIdentity).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.runtime_validation/,
  );

  const deploy = { ...architectureProposal(), status: "active" };
  await assert.rejects(
    setup(deploy as ReturnType<typeof architectureProposal>).executor.execute({ assignment: assignment(), specialist: architectureAgent }),
    /Invalid payload at specialist.architecture.response/,
  );
});
