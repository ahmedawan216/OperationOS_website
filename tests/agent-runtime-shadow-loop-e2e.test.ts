import assert from "node:assert/strict";
import { test } from "node:test";

import { DeterministicHypothesisProvider } from "../lib/agent-runtime/hypothesis-service";
import { ObservationStore } from "../lib/agent-runtime/observation-store";
import { resolveProductSnapshot, type ProductVersionManifest } from "../lib/agent-runtime/product-registry";
import { DeterministicSafetyGuardianProvider } from "../lib/agent-runtime/safety-guardian";
import { runShadowImprovementLoop } from "../lib/agent-runtime/shadow-loop";
import { runAuthoritativeShadowLoop } from "../lib/agent-runtime/authoritative-shadow-loop";
import { loadAuthoritativeObservationContext } from "../lib/agent-runtime/authoritative-shadow-loop";
import type { AuthoritativeLifecycleWriter } from "../lib/agent-runtime/authoritative-lifecycle";
import { DeterministicShadowOptimizerProvider } from "../lib/agent-runtime/shadow-optimizer";
import { decideAuthorization } from "../lib/agent-runtime/policy";
import { agentDefinitionSchema, policyBundleVersionSchema } from "../lib/agent-runtime/contracts";
import { productRegistries, productToolFixtures } from "./fixtures/product-fixtures";
import { executionEvidence, failureObservation, observedAt } from "./fixtures/observation-fixtures";

function jsonbOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbOrder);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => b.localeCompare(a)).map(([key, child]) => [key, jsonbOrder(child)]));
  return value;
}

function productContext(version: 1 | 2 = 2) {
  const expanded = version === 2;
  const manifest: ProductVersionManifest = {
    productVersionId: `operations-suite-product-v${version}`, featureVersionIds: expanded ? ["onboarding-feature-v1", "scorecards-feature-v1"] : ["onboarding-feature-v1"],
    capabilityVersionIds: expanded ? ["onboarding-record-read-capability-v1", "scorecard-draft-write-capability-v1"] : ["onboarding-record-read-capability-v1"],
    workflowVersionIds: ["onboarding-workflow-v1"], toolVersionIds: expanded ? ["onboarding-record-read-tool-v1", "scorecard-draft-write-tool-v1"] : ["onboarding-record-read-tool-v1"],
    signalDefinitionVersionIds: ["onboarding-completed-signal-v1"], evaluatorDefinitionVersionIds: ["onboarding-evaluator-v1"], contextReferenceVersionIds: ["onboarding-context-version-v1"],
  };
  return resolveProductSnapshot({ productSnapshotId: `snapshot-v${version}`, manifest, registries: productRegistries(), createdAt: observedAt });
}

function evidenceSet() {
  const store = new ObservationStore();
  const observations = [1, 2, 3].map((number) => {
    store.registerEvidence(executionEvidence({ evidenceId: `evidence-${number}`, sourceId: `trace-${number}`, productKey: "operations-suite" }));
    return store.recordObservation(failureObservation({ observationId: `observation-${number}`, evidenceIds: [`evidence-${number}`], productKey: "operations-suite" }));
  });
  store.registerEvidence(executionEvidence({ evidenceId: "counter-1", sourceId: "successful-outcome", sourceType: "execution_outcome", productKey: "operations-suite" }));
  return { store, observations };
}

function loopInput(): Parameters<typeof runShadowImprovementLoop>[0] {
  const { store, observations } = evidenceSet();
  return {
    productContext: productContext(), store, observations, counterEvidenceIds: ["counter-1"],
    ids: { environmentModelVersionId: "environment-shadow-v1", detectionId: "detection-1", patternId: "pattern-1", hypothesisId: "hypothesis-1", candidateId: "candidate-1", assessmentId: "assessment-1" },
    affectedCapabilityKeys: ["onboarding.record.read"], affectedWorkflowKeys: ["onboarding.review"], expectedOutcomeSignalKey: "onboarding.decision.exists",
    baseline: { baselineVersionId: "retry-policy-v1", baselineSnapshotId: "runtime-snapshot-1", baselineDigest: "sha256:0123456789abcdef", targetComponent: "retry_policy" as const, targetComponentKey: "runtime.retry" },
    optimizationObjective: "Reduce verified retryable failures without changing safety or evaluation.",
    allowedAgentKeys: ["workflow_discovery_specialist", "agent_architecture_specialist"], allowedModelKeys: ["deterministic-fake"], allowedToolKeys: ["onboarding.record.read-tool"],
    evaluationRequirements: { evaluatorVersionIds: ["independent-evaluator-v1"], datasetVersionIds: ["regression-suite-v1"], fixedMetricKeys: ["verification.failure_rate"], safetyMetricKeys: ["permission.integrity"], minimumCaseCount: 50 },
    requiredRiskLevel: "low" as const, hypothesisProvider: new DeterministicHypothesisProvider(),
    optimizerProvider: new DeterministicShadowOptimizerProvider({ kind: "retry_policy_patch", baseVersionId: "retry-policy-v1", changes: { maxRetriesPerStep: 2 } }),
    guardianProvider: new DeterministicSafetyGuardianProvider(), occurredAt: observedAt,
  };
}

test("end-to-end evidence loop produces safety-reviewed evaluation eligibility only", async () => {
  const result = await runShadowImprovementLoop(loopInput());
  assert.equal(result.status, "shadow");
  assert.equal(result.safetyReviewed, true);
  assert.equal(result.evaluationEligible, true);
  assert.equal(result.executable, false);
  assert.equal(result.active, false);
  assert.deepEqual(result.auditEvents.map((event) => event.sequence), [1, 2, 3, 4, 5, 6, 7]);
  assert.throws(() => (result.auditEvents as unknown[]).push({}), TypeError);
  assert.equal(JSON.stringify(result).match(/chain.?of.?thought|hiddenReasoning|reasoningTokens/i), null);
});

test("validated shadow records checkpoint in order; a failed durable checkpoint stops optimization", async () => {
  const stages: string[] = [];
  const input = loopInput();
  input.persistValidatedRecord = async ({ kind }) => { stages.push(kind); };
  await runShadowImprovementLoop(input);
  assert.deepEqual(stages, ["environment", "pattern", "hypothesis", "candidate", "safety"]);
  const blocked = loopInput();
  const reached: string[] = [];
  blocked.persistValidatedRecord = async ({ kind }) => {
    reached.push(kind);
    if (kind === "pattern") throw new Error("Authoritative store unavailable");
  };
  await assert.rejects(() => runShadowImprovementLoop(blocked), /Authoritative store unavailable/);
  assert.deepEqual(reached, ["environment", "pattern"]);
});

test("authoritative shadow wrapper rejects an observation without durable source provenance", async () => {
  const request = loopInput();
  const writer = {
    async requireSource(id: string) {
      if (id === request.productContext.product.versionId) return { payload: request.productContext };
      throw new Error("Authoritative observation is absent");
    },
  } as unknown as AuthoritativeLifecycleWriter;
  await assert.rejects(() => runAuthoritativeShadowLoop({ request, writer,
    executionId: request.observations[0]!.executionId! }), /Authoritative observation is absent/);
});

test("authoritative shadow wrapper rejects an in-memory evidence graph absent from durable sources", async () => {
  const request = loopInput();
  const writer = { async requireSource(id: string) {
    if (id === request.productContext.product.versionId) return { payload: request.productContext };
    const observation = request.observations.find((item) => item.observationId === id);
    if (observation) return { payload: observation, source_execution_id: observation.executionId };
    throw new Error("Durable evidence is absent");
  } } as unknown as AuthoritativeLifecycleWriter;
  await assert.rejects(() => runAuthoritativeShadowLoop({ request, writer,
    executionId: request.observations[0]!.executionId! }), /Durable evidence is absent/);
});

test("shadow context is rehydrated only from durable, same-snapshot evidence and observations", async () => {
  const { store, observations } = evidenceSet();
  const writer = { async requireSource(id: string) {
    if (id.startsWith("observation-")) return { payload: observations.find((item) => item.observationId === id) };
    return { payload: store.requireEvidence(id) };
  } } as unknown as AuthoritativeLifecycleWriter;
  const context = await loadAuthoritativeObservationContext({ writer, productKey: "operations-suite",
    productSnapshotId: "snapshot-v2", observationIds: observations.map((item) => item.observationId),
    counterEvidenceIds: ["counter-1"] });
  assert.deepEqual(context.observations.map((item) => item.observationId), observations.map((item) => item.observationId));
  assert.equal(context.store.requireEvidence("counter-1").sourceType, "execution_outcome");
  await assert.rejects(() => loadAuthoritativeObservationContext({ writer, productKey: "other-product",
    productSnapshotId: "snapshot-v2", observationIds: [observations[0]!.observationId],
    counterEvidenceIds: [] }), /crosses the selected product/);
  await assert.rejects(() => loadAuthoritativeObservationContext({ writer, productKey: "operations-suite",
    productSnapshotId: "snapshot-v2", observationIds: [], counterEvidenceIds: [] }), /missing/);
});

test("shadow context accepts equivalent PostgreSQL jsonb records without losing provenance", async () => {
  const { store, observations } = evidenceSet();
  const writer = { async requireSource(id: string) {
    const observation = observations.find((item) => item.observationId === id);
    return { payload: jsonbOrder(observation ?? store.requireEvidence(id)) };
  } } as unknown as AuthoritativeLifecycleWriter;
  const context = await loadAuthoritativeObservationContext({ writer, productKey: "operations-suite",
    productSnapshotId: "snapshot-v2", observationIds: observations.map((item) => item.observationId),
    counterEvidenceIds: ["counter-1"] });
  assert.equal(context.observations.length, 3);
  assert.equal(context.store.requireEvidence("counter-1").sourceId, "successful-outcome");
});

test("authoritative shadow loop accepts database-ordered product and evidence while retaining immutable identities", async () => {
  const request = loopInput();
  const writer = {
    async requireSource(id: string) {
      if (id === request.productContext.product.versionId) return { payload: jsonbOrder(request.productContext) };
      const observation = request.observations.find((item) => item.observationId === id);
      if (observation) return { payload: jsonbOrder(observation), source_execution_id: observation.executionId };
      return { payload: jsonbOrder(request.store.requireEvidence(id)) };
    },
    shadowRecordSink() { return async () => {}; },
  } as unknown as AuthoritativeLifecycleWriter;
  const result = await runAuthoritativeShadowLoop({ request, writer,
    executionId: request.observations[0]!.executionId! });
  assert.equal(result.status, "shadow");
  assert.equal(result.executable, false);
});

test("new registered capability is observable without core changes but grants no permission", () => {
  const before = productContext(1);
  const after = productContext(2);
  assert.equal(before.capabilities.some((item) => item.capabilityKey === "scorecard.draft.write"), false);
  assert.equal(after.capabilities.some((item) => item.capabilityKey === "scorecard.draft.write"), true);
  const agent = agentDefinitionSchema.parse({ agentKey: "workflow_discovery_specialist", versionId: "specialist-v1", version: 1, role: "specialist", status: "active", purpose: "Read-only discovery.", instructionTemplate: "Observe only.", inputSchema: "workflow-discovery-input-v1", outputSchema: "workflow-model-v1", modelPolicy: { allowedModelKeys: ["deterministic-fake"], temperatureMin: 0, temperatureMax: 0, maxOutputTokens: 2_000, timeoutMs: 10_000 }, capabilityGrants: [], createdBy: "operationos", createdAt: observedAt });
  const policy = policyBundleVersionSchema.parse({ policyKey: "default", versionId: "policy-v1", version: 1, status: "active", description: "Deny by default.", defaultDecision: "deny", mediumRiskRequiresApproval: true, highRiskRequiresExplicitApproval: true, createdBy: "operationos", createdAt: observedAt });
  const decision = decideAuthorization({ intent: { actorId: "actor", tenantId: "tenant", capabilityKey: "scorecard.draft.write", resourceScope: "tenant:tenant/scorecards/1", environment: "preview", actionType: "scorecard.draft.write", actionPayload: {} }, agent, tool: productToolFixtures[1]!, policy, now: observedAt });
  assert.equal(decision.decision, "deny");
});

test("stale snapshots, cross-product evidence, and contradictory self-support fail closed", async () => {
  const stale = loopInput();
  stale.productContext = productContext(1);
  await assert.rejects(() => runShadowImprovementLoop(stale), /outside the environment model snapshot/);
  const cross = loopInput();
  cross.observations = cross.observations.map((item, index) => index === 2 ? { ...item, productKey: "other-product" } : item);
  await assert.rejects(() => runShadowImprovementLoop(cross), /outside the environment model snapshot|cross product/);
  const circular = loopInput();
  circular.counterEvidenceIds = ["evidence-1"];
  await assert.rejects(() => runShadowImprovementLoop(circular), /simultaneously support and contradict/);
});

test("optimizer and Guardian provider failures stop the loop without activation", async () => {
  const optimizerFailure = loopInput();
  optimizerFailure.optimizerProvider = { proposeCandidate: async () => { throw new Error("optimizer internal secret"); } };
  await assert.rejects(() => runShadowImprovementLoop(optimizerFailure), (error: Error & { runtimeError?: { code: string } }) => error.message === "Shadow optimizer provider failed" && error.runtimeError?.code === "PROVIDER_ERROR");
  const guardianFailure = loopInput();
  guardianFailure.guardianProvider = { assessCandidate: async () => { throw new Error("guardian internal secret"); } };
  const blocked = await runShadowImprovementLoop(guardianFailure);
  assert.equal(blocked.evaluationEligible, false);
  assert.equal(blocked.active, false);
  assert.equal(blocked.executable, false);
});

test("one-off noise cannot enter the complete optimization loop", async () => {
  const input = loopInput();
  input.observations = input.observations.slice(0, 1);
  await assert.rejects(() => runShadowImprovementLoop(input), /requires repeated evidence/);
});
