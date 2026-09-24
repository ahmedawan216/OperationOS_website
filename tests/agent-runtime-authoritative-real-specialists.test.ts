import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthoritativeManager } from "../lib/agent-runtime/authoritative-manager";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";
import type { AgentRuntimePersistence } from "../lib/agent-runtime/persistence";
import type { ExecutionRecord } from "../lib/agent-runtime/execution-repository";
import { dayThreeAgentFixtures } from "../lib/agent-runtime/day-three-fixtures";
import { dayOnePolicyFixture } from "../lib/agent-runtime/fixtures";
import { resolveProductSnapshot } from "../lib/agent-runtime/product-registry";
import type { ManagerPlanningRequest } from "../lib/agent-runtime/manager-contracts";
import { DeterministicSpecialistProvider } from "../lib/agent-runtime/testing/fake-specialist-provider";
import { productRegistries, productToolFixtures } from "./fixtures/product-fixtures";
import { architectureProposal, workflowInput, workflowModel } from "./fixtures/specialist-fixtures";

const at = "2026-09-24T12:00:00.000Z";
function setup() {
  const committed: string[] = [];
  let sequence = 0;
  const ids = () => (++sequence === 1 ? "execution-1" : `id-${sequence}`);
  const productContext = resolveProductSnapshot({ productSnapshotId: "product-snapshot-1",
    manifest: { productVersionId: "operations-suite-product-v1", featureVersionIds: ["onboarding-feature-v1"],
      capabilityVersionIds: ["onboarding-record-read-capability-v1"],
      workflowVersionIds: ["onboarding-workflow-v1"], toolVersionIds: ["onboarding-record-read-tool-v1"],
      signalDefinitionVersionIds: ["onboarding-completed-signal-v1"],
      evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"],
      contextReferenceVersionIds: ["onboarding-context-version-v1"] },
    registries: productRegistries(), createdAt: at });
  const writer = { async requireSource() { return { payload: productContext }; } } as unknown as AuthoritativeLifecycleWriter;
  const persist = {
    async loadAgentDefinitions() { return dayThreeAgentFixtures; },
    async loadToolDefinitions() { return productToolFixtures; },
    async loadPolicyVersions() { return [dayOnePolicyFixture]; },
    async createOrGetExecution(record: ExecutionRecord) { committed.push(`execution:${record.executionId}`); return { record, created: true }; },
    async transitionExecution(_id: string, _from: string, to: string) { committed.push(`state:${to}`); },
    async persistStepAttempt(record: { stepId: string; status: string }) { committed.push(`attempt:${record.stepId}:${record.status}`); },
    async persistAssignment(assignment: { stepId: string }) { committed.push(`assignment:${assignment.stepId}`); },
    async appendTrace(event: { type: string }) { committed.push(`trace:${event.type}`); },
    async appendOutcome(signal: { metricKey: string }) { committed.push(`outcome:${signal.metricKey}`); },
    async createApproval() { throw new Error("No approval required for draft work"); },
  } as AgentRuntimePersistence;
  const provider = new DeterministicSpecialistProvider({
    workflow: [{ kind: "response", response: { output: workflowModel() } }],
    architecture: [{ kind: "response", response: { output: architectureProposal() } }],
  });
  const managerProvider = { async generatePlan(request: ManagerPlanningRequest) { return {
    output: { plan: { planId: request.planId, executionId: request.snapshot.executionId,
      rationaleSummary: "Verify a workflow before proposing its architecture.",
      steps: [
        { stepId: "workflow-step", sequence: 0, objective: "Discover a bounded workflow",
          assignedAgentKey: "workflow_discovery_specialist", inputRefs: [{ kind: "goal_input", id: "brief" }],
          expectedOutputSchema: "workflow-model-v1", acceptanceCriterionIds: [],
          requiredCapabilities: [], riskLevel: "low", dependsOn: [] },
        { stepId: "architecture-step", sequence: 1, objective: "Propose agent boundaries",
          assignedAgentKey: "agent_architecture_specialist", inputRefs: [{ kind: "step_output", id: "workflow-step" }],
          expectedOutputSchema: "agent-system-proposal-v1", acceptanceCriterionIds: ["criterion-decision"],
          requiredCapabilities: [], riskLevel: "low", dependsOn: ["workflow-step"] },
      ], verificationStepIds: ["architecture-step"] }, decisionSummary: "Use registered specialists." },
  }; } };
  return { productContext, writer, persist, provider, managerProvider, committed, ids };
}

test("real registered specialists delegate through the durable Manager and verified workflow prerequisite", async () => {
  const input = setup();
  const service = await createAuthoritativeManager({ tenantId: "operationos", persistence: input.persist,
    managerProvider: input.managerProvider, specialistProvider: input.provider,
    productContext: input.productContext, workflowEvidence: workflowInput().evidence, writer: input.writer,
    verifier: { versionId: "verified-architecture-v1", async verify({ criterion }) {
      return { criterionId: criterion.id, satisfied: true,
        evidenceRefs: [{ kind: "step_output", id: "architecture-step" }], summary: "Validated architecture output." };
    } }, maxReplans: 0, now: () => new Date(at), createId: input.ids });
  const result = await service.run({ goal: { goalId: "goal-1", tenantId: "operationos", actorId: "founder",
    objective: "Model an internal onboarding review and propose a bounded architecture.",
    inputs: { brief: "An operator reviews a supplied onboarding request." },
    acceptanceCriteria: [{ id: "criterion-decision", description: "Verified architecture proposal exists",
      evaluator: "deterministic", required: true }], constraints: ["Draft only", "No external effects"],
    requestedAt: at, idempotencyKey: "real-specialist-persistence-proof" },
    manifest: { managerVersionId: dayThreeAgentFixtures[0]!.versionId,
      specialistVersionIds: [dayThreeAgentFixtures[1]!.versionId, dayThreeAgentFixtures[2]!.versionId],
      policyBundleVersionId: dayOnePolicyFixture.versionId, toolVersionIds: [productToolFixtures[0]!.versionId],
      modelBindings: { manager: "deterministic-fake" } },
    budget: { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 60_000, maxCostUsd: 1 } });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(input.provider.workflowRequests.length, 1);
  assert.equal(input.provider.architectureRequests.length, 1);
  assert.ok(input.committed.indexOf("trace:workflow.verified") < input.committed.indexOf("assignment:architecture-step"));
  assert.ok(input.committed.includes("state:succeeded"));
  assert.ok(input.committed.includes("outcome:goal_success"));
});

test("unregistered product snapshot and undeclared workflow evidence fail before specialist provider work", async () => {
  const input = setup();
  await assert.rejects(() => createAuthoritativeManager({ tenantId: "operationos", persistence: input.persist,
    managerProvider: input.managerProvider, specialistProvider: input.provider,
    productContext: { ...input.productContext, snapshot: { ...input.productContext.snapshot, productSnapshotId: "forged" } },
    workflowEvidence: workflowInput().evidence, writer: input.writer,
    verifier: { versionId: "v", async verify() { return {}; } }, maxReplans: 0 }), /authoritative registered snapshot/);
  assert.equal(input.provider.workflowRequests.length, 0);
  const safe = setup();
  const service = await createAuthoritativeManager({ tenantId: "operationos", persistence: safe.persist,
    managerProvider: safe.managerProvider, specialistProvider: safe.provider,
    productContext: safe.productContext,
    workflowEvidence: [{ ...workflowInput().evidence[0]!, sourceRef: { kind: "goal_input", id: "undeclared" } }],
    writer: safe.writer, verifier: { versionId: "v", async verify() { return {}; } },
    maxReplans: 0, now: () => new Date(at), createId: safe.ids });
  await assert.rejects(() => service.run({ goal: { goalId: "goal-1", tenantId: "operationos", actorId: "founder",
    objective: "Internal workflow", inputs: { brief: "Provided" },
    acceptanceCriteria: [{ id: "criterion-decision", description: "Review output", evaluator: "deterministic", required: true }],
    constraints: [],
    requestedAt: at, idempotencyKey: "bad-evidence" },
    manifest: { managerVersionId: dayThreeAgentFixtures[0]!.versionId,
      specialistVersionIds: [dayThreeAgentFixtures[1]!.versionId, dayThreeAgentFixtures[2]!.versionId],
      policyBundleVersionId: dayOnePolicyFixture.versionId, toolVersionIds: [],
      modelBindings: { manager: "deterministic-fake" } },
    budget: { maxSteps: 2, maxRetriesPerStep: 0, maxWallTimeMs: 60_000, maxCostUsd: 1 } }), /not a declared bounded goal input/);
  assert.equal(safe.provider.workflowRequests.length, 0);
});
