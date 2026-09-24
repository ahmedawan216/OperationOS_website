import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthoritativeManager } from "../lib/agent-runtime/authoritative-manager";
import { dayThreeAgentFixtures } from "../lib/agent-runtime/day-three-fixtures";
import { dayOnePolicyFixture } from "../lib/agent-runtime/fixtures";
import { DeterministicFakeManagerProvider } from "../lib/agent-runtime/testing/fake-manager-provider";
import { DeterministicFakeSpecialistExecutor } from "../lib/agent-runtime/testing/fake-specialist-executor";
import type { AgentRuntimePersistence } from "../lib/agent-runtime/persistence";
import type { ExecutionRecord } from "../lib/agent-runtime/execution-repository";

const now = new Date("2026-09-24T12:00:00.000Z");
const goal = {
  goalId: "controlled-goal", tenantId: "operationos", actorId: "founder",
  objective: "Discover a harmless internal workflow and propose its agent architecture.",
  inputs: { brief: "Review the internal handoff process." },
  acceptanceCriteria: [{ id: "criterion", description: "Verified architecture output", evaluator: "deterministic" as const, required: true }],
  constraints: ["No side effects"], requestedAt: now.toISOString(), idempotencyKey: "controlled-proof-2026-09-24",
};
const manifest = {
  managerVersionId: dayThreeAgentFixtures[0]!.versionId,
  specialistVersionIds: [dayThreeAgentFixtures[1]!.versionId, dayThreeAgentFixtures[2]!.versionId] as const,
  policyBundleVersionId: dayOnePolicyFixture.versionId,
  toolVersionIds: [], modelBindings: { manager: "deterministic-fake" },
};
const budget = { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 30_000, maxCostUsd: 1 };

function setup(failOn?: string) {
  const committed: string[] = [];
  let id = 0;
  const persist = {
    async loadAgentDefinitions() { return dayThreeAgentFixtures; },
    async loadToolDefinitions() { return []; },
    async loadPolicyVersions() { return [dayOnePolicyFixture]; },
    async createOrGetExecution(record: ExecutionRecord) { committed.push(`execution:${record.executionId}`); return { record, created: true }; },
    async transitionExecution(_id: string, _from: string, to: string) { committed.push(`state:${to}`); },
    async persistStepAttempt(record: { stepId: string; status: string }) { committed.push(`attempt:${record.stepId}:${record.status}`); },
    async persistAssignment(assignment: { stepId: string }, attemptId: string, agentKey: string) { assert.ok(attemptId); committed.push(`assignment:${assignment.stepId}:${agentKey}`); },
    async appendTrace(event: { type: string }) {
      if (failOn === event.type) throw new Error("database failed");
      committed.push(`trace:${event.type}`);
    },
    async appendOutcome(signal: { metricKey: string }) { committed.push(`outcome:${signal.metricKey}`); },
    async createApproval() { throw new Error("No approval was requested"); },
  } as AgentRuntimePersistence;
  const plan = {
    plan: { planId: "plan", executionId: "execution", rationaleSummary: "Verify workflow before architecture.",
      steps: [
        { stepId: "workflow", sequence: 0, objective: "Discover workflow", assignedAgentKey: "workflow_discovery_specialist",
          inputRefs: [{ kind: "goal_input", id: "brief" }], expectedOutputSchema: "workflow-model-v1",
          acceptanceCriterionIds: [], requiredCapabilities: [], riskLevel: "low", dependsOn: [] },
        { stepId: "architecture", sequence: 1, objective: "Propose architecture", assignedAgentKey: "agent_architecture_specialist",
          inputRefs: [{ kind: "step_output", id: "workflow" }], expectedOutputSchema: "agent-system-proposal-v1",
          acceptanceCriterionIds: ["criterion"], requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow"] },
      ], verificationStepIds: ["architecture"] },
    decisionSummary: "Use only registered specialists.",
  };
  const managerProvider = new DeterministicFakeManagerProvider([{ kind: "response", response: { output: plan } }]);
  const specialistExecutor = new DeterministicFakeSpecialistExecutor([
    { kind: "response", response: { result: { executionId: "execution", stepId: "workflow", status: "completed", output: { workflow: true }, evidenceRefs: [{ kind: "step_output", id: "workflow" }], unmetCriteria: [] } } },
    { kind: "response", response: { result: { executionId: "execution", stepId: "architecture", status: "completed", output: { proposal: true }, evidenceRefs: [{ kind: "step_output", id: "architecture" }], unmetCriteria: [] } } },
  ]);
  const verifier = { versionId: "verifier-v1", async verify() {
    return { criterionId: "criterion", satisfied: true, evidenceRefs: [{ kind: "step_output", id: "architecture" }], summary: "Architecture output verified." };
  } };
  return { committed, persist, managerProvider, specialistExecutor, verifier, createId: () => {
    id += 1;
    return id === 1 ? "execution" : id === 4 ? "plan" : `record-${id}`;
  } };
}

test("Manager checkpoints durable execution before provider work and persists verified outcomes", async () => {
  const deps = setup();
  const service = await createAuthoritativeManager({ tenantId: "operationos", persistence: deps.persist,
    managerProvider: deps.managerProvider, specialistExecutor: deps.specialistExecutor,
    verifier: deps.verifier, maxReplans: 0, now: () => now, createId: deps.createId });
  const result = await service.run({ goal, manifest, budget });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.deepEqual(deps.specialistExecutor.calls.map((call) => call.assignment.stepId), ["workflow", "architecture"]);
  assert.ok(deps.committed.indexOf("execution:execution") < deps.committed.indexOf("trace:model.requested"));
  assert.ok(deps.committed.includes("outcome:goal_success"));
  assert.ok(deps.committed.includes("state:succeeded"));
});

test("durable trace failure stops before Manager provider and specialists execute", async () => {
  const deps = setup("execution.created");
  const service = await createAuthoritativeManager({ tenantId: "operationos", persistence: deps.persist,
    managerProvider: deps.managerProvider, specialistExecutor: deps.specialistExecutor,
    verifier: deps.verifier, maxReplans: 0, now: () => now, createId: deps.createId });
  await assert.rejects(service.run({ goal, manifest, budget }), /Authoritative runtime persistence failed/);
  assert.equal(deps.managerProvider.requests.length, 0);
  assert.equal(deps.specialistExecutor.calls.length, 0);
});
