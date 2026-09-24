import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerSupabaseClient } from "../supabase/server-client";
import { productSummarySchema, learningSummarySchema, improvementSummarySchema,
  evaluationSummarySchema, safetySummarySchema } from "../control-plane/contracts";
import { toolDefinitionSchema } from "./contracts";
import { createToolRegistry } from "./registry";
import { createProductRegistries, resolveProductSnapshot } from "./product-registry";
import {
  productDefinitionSchema, productSnapshotSchema, productCapabilitySchema,
  productFeatureSchema, productWorkflowMetadataSchema, outcomeSignalDefinitionSchema,
  productEvaluatorDefinitionSchema, productContextReferenceSchema,
} from "./product-contracts";
import { observationEvidenceSchema, observationSchema } from "./observation-contracts";
import { productEnvironmentModelSchema } from "./environment-contracts";
import { evidencePatternSchema, hypothesisSchema } from "./hypothesis-contracts";
import { shadowCandidateSchema } from "./optimizer-contracts";
import { evaluationPlanSchema, evaluationDatasetSchema, evaluatorDefinitionV2Schema } from "./evaluation-contracts";
import { EvaluationRegistry } from "./evaluation-registry";
import { evaluationRunSchema } from "./evaluation-engine";
import { comparisonSchema, compareEvaluation } from "./comparison-engine";
import { safetyAssessmentSchema } from "./safety-contracts";
import { riskGateDecisionSchema } from "./risk-gate";
import { applyRiskGate } from "./risk-gate";
import { canaryConfigSchema } from "./deployment-controller";
import { assertSafeRuntimePayload } from "./supabase-persistence";

type Kind = "product" | "evidence" | "observation" | "environment" | "pattern" | "hypothesis" |
  "candidate" | "dataset" | "evaluator" | "evaluation_plan" | "evaluation_run" | "comparison" | "safety" | "risk_decision" | "canary";
const schemas: Record<Kind, z.ZodType> = {
  product: z.object({ product: productDefinitionSchema, snapshot: productSnapshotSchema,
    features: z.array(productFeatureSchema), capabilities: z.array(productCapabilitySchema),
    workflows: z.array(productWorkflowMetadataSchema), signals: z.array(outcomeSignalDefinitionSchema),
    evaluators: z.array(productEvaluatorDefinitionSchema), tools: z.array(toolDefinitionSchema),
    contexts: z.array(productContextReferenceSchema),
  }).strict()
    .refine(({ product, snapshot, features, capabilities, workflows, signals, evaluators }) => snapshot.productVersionId === product.versionId &&
      ["featureVersionIds", "capabilityVersionIds", "workflowVersionIds", "signalDefinitionVersionIds", "evaluatorDefinitionVersionIds", "contextReferenceVersionIds"]
        .every((key) => JSON.stringify([...(product[key as keyof typeof product] as string[])].sort()) ===
          JSON.stringify([...(snapshot[key as keyof typeof snapshot] as string[])].sort())) &&
      JSON.stringify(features.map((item) => item.versionId).sort()) === JSON.stringify([...snapshot.featureVersionIds].sort()) &&
      JSON.stringify(capabilities.map((item) => item.versionId).sort()) === JSON.stringify([...snapshot.capabilityVersionIds].sort()) &&
      JSON.stringify(workflows.map((item) => item.versionId).sort()) === JSON.stringify([...snapshot.workflowVersionIds].sort()) &&
      JSON.stringify(signals.map((item) => item.versionId).sort()) === JSON.stringify([...snapshot.signalDefinitionVersionIds].sort()) &&
      JSON.stringify(evaluators.map((item) => item.versionId).sort()) === JSON.stringify([...snapshot.evaluatorDefinitionVersionIds].sort()) &&
      [...features, ...capabilities, ...workflows, ...signals, ...evaluators].every((item) => item.productKey === product.productKey),
    "Product snapshot must match the registered product version"),
  evidence: observationEvidenceSchema,
  observation: observationSchema,
  environment: productEnvironmentModelSchema,
  pattern: evidencePatternSchema,
  hypothesis: hypothesisSchema,
  candidate: shadowCandidateSchema,
  dataset: evaluationDatasetSchema,
  evaluator: evaluatorDefinitionV2Schema,
  evaluation_plan: evaluationPlanSchema,
  evaluation_run: evaluationRunSchema,
  comparison: comparisonSchema,
  safety: safetyAssessmentSchema,
  risk_decision: riskGateDecisionSchema,
  canary: canaryConfigSchema,
};
const parentKinds: Partial<Record<Kind, readonly Kind[]>> = {
  evidence: ["product", "evidence"], observation: ["evidence"],
  environment: ["observation"], pattern: ["environment", "observation"],
  hypothesis: ["pattern"], candidate: ["hypothesis"],
  dataset: ["product"], evaluator: ["product"],
  evaluation_plan: ["candidate"], evaluation_run: ["evaluation_plan"],
  comparison: ["evaluation_run"], safety: ["candidate"],
  risk_decision: ["comparison"], canary: ["risk_decision"],
};
const idFields: Record<Kind, string> = {
  product: "versionId", evidence: "evidenceId", observation: "observationId",
  environment: "modelVersionId", pattern: "patternId", hypothesis: "hypothesisId",
  candidate: "candidateId", evaluation_plan: "planId", evaluation_run: "runId",
  dataset: "datasetVersionId", evaluator: "evaluatorVersionId",
  comparison: "comparisonId", safety: "assessmentId", risk_decision: "candidateId", canary: "canaryId",
};

function digest(payload: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function checked(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`Authoritative lifecycle ${operation} failed`);
}

/**
 * Append-only source writer. This does not form hypotheses or decide promotion.
 * Its caller must pass outputs from the existing validated domain operations.
 * Source and projection writes are distinct; a projection cannot exist without
 * its committed source because of the composite database foreign key.
 */
export class AuthoritativeLifecycleWriter {
  constructor(
    private readonly tenantId: string,
    private readonly productKey: string,
    private readonly client: SupabaseClient = getServerSupabaseClient(),
  ) {
    if (process.env.CONTROL_PLANE_DATA_MODE !== "authoritative" ||
      tenantId !== process.env.CONTROL_PLANE_TENANT_ID?.trim() ||
      !/^[a-z][a-z0-9._-]*$/.test(productKey)) {
      throw new Error("Authoritative lifecycle tenant or product is not configured");
    }
  }

  async requireSource(id: string, kind?: Kind): Promise<{ record_kind: string; source_digest: string; payload: unknown; parent_record_id: string | null }> {
    const { data, error } = await this.client.from("agent_runtime_lifecycle_records")
      .select("record_kind,source_digest,payload,parent_record_id").eq("tenant_id", this.tenantId)
      .eq("product_key", this.productKey).eq("record_id", id).single();
    checked(error, "source lookup");
    if (!data || (kind && data.record_kind !== kind)) throw new Error("Lifecycle source is missing or has the wrong kind");
    return data;
  }

  async append(input: {
    kind: Kind;
    recordId: string;
    payload: unknown;
    occurredAt: string;
    executionId?: string;
    parentRecordId?: string;
  }): Promise<string> {
    if (input.kind === "comparison" || input.kind === "risk_decision" || input.kind === "canary") {
      throw new Error("Comparison, Risk Gate and canary records require their authoritative engines");
    }
    return this.appendValidated(input);
  }

  async compareAndPersist(input: { comparisonId: string; executionId: string; runId: string; occurredAt: string }) {
    const run = evaluationRunSchema.parse((await this.requireSource(input.runId, "evaluation_run")).payload);
    const plan = evaluationPlanSchema.parse((await this.requireSource(run.planId, "evaluation_plan")).payload);
    const result = compareEvaluation({ comparisonId: input.comparisonId, plan, run });
    await this.appendValidated({ kind: "comparison", recordId: result.comparisonId,
      parentRecordId: run.runId, executionId: input.executionId, payload: result, occurredAt: input.occurredAt });
    return result;
  }

  async decideRisk(input: {
    executionId: string;
    candidateId: string;
    comparisonId: string;
    assessmentId: string;
    deploymentTarget: "test" | "preview";
    occurredAt: string;
  }) {
    const candidate = shadowCandidateSchema.parse((await this.requireSource(input.candidateId, "candidate")).payload);
    const comparison = comparisonSchema.parse((await this.requireSource(input.comparisonId, "comparison")).payload);
    const run = evaluationRunSchema.parse((await this.requireSource(comparison.runId, "evaluation_run")).payload);
    const plan = evaluationPlanSchema.parse((await this.requireSource(run.planId, "evaluation_plan")).payload);
    const assessment = safetyAssessmentSchema.parse((await this.requireSource(input.assessmentId, "safety")).payload);
    if (candidate.candidateId !== plan.candidateId || candidate.productKey !== this.productKey ||
      plan.productKey !== this.productKey || plan.productSnapshotId !== candidate.productSnapshotId ||
      plan.baselineVersionId !== candidate.baseline.baselineVersionId ||
      plan.candidateVersion !== candidate.candidateVersion ||
      run.candidateId !== candidate.candidateId || run.planId !== plan.planId ||
      comparison.planId !== plan.planId || assessment.candidateId !== candidate.candidateId) {
      throw new Error("Risk Gate input identities or immutable baseline disagree");
    }
    const decision = applyRiskGate({ candidate, plan, comparison,
      guardianAssessment: assessment, deploymentTarget: input.deploymentTarget });
    const recordId = `risk:${candidate.candidateId}:${comparison.comparisonId}`;
    await this.appendValidated({ kind: "risk_decision", recordId, payload: decision,
      executionId: input.executionId, parentRecordId: comparison.comparisonId, occurredAt: input.occurredAt });
    return decision;
  }

  private async appendValidated(input: {
    kind: Kind;
    recordId: string;
    payload: unknown;
    occurredAt: string;
    executionId?: string;
    parentRecordId?: string;
  }): Promise<string> {
    if (!input.recordId || input.recordId.length > 200) throw new Error("Invalid lifecycle record ID");
    const payload = schemas[input.kind].parse(input.payload) as Record<string, unknown>;
    if (input.kind === "product") {
      const context = payload as {
        product: z.infer<typeof productDefinitionSchema>; snapshot: z.infer<typeof productSnapshotSchema>;
        features: z.infer<typeof productFeatureSchema>[]; capabilities: z.infer<typeof productCapabilitySchema>[];
        workflows: z.infer<typeof productWorkflowMetadataSchema>[]; signals: z.infer<typeof outcomeSignalDefinitionSchema>[];
        evaluators: z.infer<typeof productEvaluatorDefinitionSchema>[]; tools: z.infer<typeof toolDefinitionSchema>[];
        contexts: z.infer<typeof productContextReferenceSchema>[];
      };
      const resolved = resolveProductSnapshot({ productSnapshotId: context.snapshot.productSnapshotId,
        createdAt: context.snapshot.createdAt,
        manifest: { productVersionId: context.product.versionId,
          featureVersionIds: context.snapshot.featureVersionIds, capabilityVersionIds: context.snapshot.capabilityVersionIds,
          workflowVersionIds: context.snapshot.workflowVersionIds, toolVersionIds: context.snapshot.toolVersionIds,
          signalDefinitionVersionIds: context.snapshot.signalDefinitionVersionIds,
          evaluatorDefinitionVersionIds: context.snapshot.evaluatorDefinitionVersionIds,
          contextReferenceVersionIds: context.snapshot.contextReferenceVersionIds },
        registries: createProductRegistries({ products: [context.product], features: context.features,
          capabilities: context.capabilities, workflows: context.workflows, signals: context.signals,
          evaluators: context.evaluators, contexts: context.contexts, tools: createToolRegistry(context.tools) }),
      });
      if (JSON.stringify(resolved.snapshot) !== JSON.stringify(context.snapshot)) {
        throw new Error("Authoritative product snapshot differs from registered versions");
      }
    }
    const key = input.kind === "product" ? (payload.product as { productKey: string }).productKey : payload.productKey;
    if (key && key !== this.productKey) throw new Error("Cross-product lifecycle output rejected");
    const expectedId = input.kind === "product" ? (payload.product as { versionId: string }).versionId : payload[idFields[input.kind]];
    if (input.kind !== "risk_decision" && input.recordId !== expectedId) {
      throw new Error("Lifecycle record identity disagrees with the validated domain output");
    }
    if (input.kind === "risk_decision" && input.recordId !== `risk:${payload.candidateId}:${input.parentRecordId}`) {
      throw new Error("Risk decision identity must bind its candidate and comparison");
    }
    if (input.kind === "product" && (input.executionId || input.parentRecordId)) {
      throw new Error("Product version is a registered root, not a derived execution");
    }
    if (input.kind !== "product" && !["dataset", "evaluator"].includes(input.kind) && (!input.executionId || !input.parentRecordId)) {
      throw new Error("Lifecycle output requires execution and parent provenance");
    }
    if (["dataset", "evaluator"].includes(input.kind) && (!input.parentRecordId || input.executionId)) {
      throw new Error("Versioned evaluation definitions require a product parent without execution authority");
    }
    if (input.parentRecordId) {
      const parent = await this.requireSource(input.parentRecordId);
      if (!parentKinds[input.kind]?.includes(parent.record_kind as Kind)) throw new Error("Invalid lifecycle parent kind");
      if (input.kind === "evidence" && parent.record_kind === "product") {
        const context = schemas.product.parse(parent.payload) as { product: { versionId: string }; snapshot: { productSnapshotId: string } };
        if (context.product.versionId !== payload.productVersionId || context.snapshot.productSnapshotId !== payload.productSnapshotId) {
          throw new Error("Evidence crosses the registered product snapshot");
        }
      }
      if (input.kind === "candidate" && (parent.payload as { productSnapshotId?: string }).productSnapshotId !== payload.productSnapshotId) {
        throw new Error("Candidate crosses its hypothesis snapshot");
      }
      if (input.kind === "hypothesis" && !evidencePatternSchema.parse(parent.payload).eligibleForHypothesis) {
        throw new Error("Insufficient evidence cannot become an authoritative hypothesis");
      }
      if (input.kind === "candidate") {
        const hypothesis = hypothesisSchema.parse(parent.payload);
        if (hypothesis.supportEvidenceIds.some((id) => !(payload.evidenceIds as string[]).includes(id)) ||
          hypothesis.counterEvidenceIds.some((id) => !(payload.counterEvidenceIds as string[]).includes(id))) {
          throw new Error("Candidate cannot suppress hypothesis evidence or counter-evidence");
        }
      }
      if (input.kind === "evaluation_plan") {
        const candidate = shadowCandidateSchema.parse(parent.payload);
        const plan = evaluationPlanSchema.parse(payload);
        if (plan.candidateId !== candidate.candidateId || plan.productKey !== this.productKey ||
          plan.productSnapshotId !== candidate.productSnapshotId ||
          plan.baselineVersionId !== candidate.baseline.baselineVersionId ||
          plan.baselineDigest !== candidate.baseline.baselineDigest ||
          plan.candidateDigest !== parent.source_digest) {
          throw new Error("Frozen evaluation plan does not bind the immutable candidate and baseline");
        }
        const preReview = safetyAssessmentSchema.parse((await this.requireSource(plan.guardianAssessmentId, "safety")).payload);
        if (preReview.candidateId !== candidate.candidateId) throw new Error("Evaluation Guardian review belongs to another candidate");
        const dataset = evaluationDatasetSchema.parse((await this.requireSource(plan.datasetVersionId, "dataset")).payload);
        const evaluators = await Promise.all(plan.evaluatorVersionIds.map(async (id) =>
          evaluatorDefinitionV2Schema.parse((await this.requireSource(id, "evaluator")).payload)));
        const registry = new EvaluationRegistry();
        registry.registerDataset(dataset);
        for (const evaluator of evaluators) registry.registerEvaluator(evaluator);
        registry.freezePlan(plan);
      }
      if (input.kind === "evaluation_run") {
        const plan = evaluationPlanSchema.parse(parent.payload);
        const run = evaluationRunSchema.parse(payload);
        if (run.planId !== plan.planId || run.datasetVersionId !== plan.datasetVersionId ||
          run.baselineVersionId !== plan.baselineVersionId || run.candidateId !== plan.candidateId ||
          run.conditionsDigest !== plan.conditionsDigest ||
          JSON.stringify(run.evaluatorVersionIds) !== JSON.stringify(plan.evaluatorVersionIds)) {
          throw new Error("Evaluation run changed its frozen baseline, cases, evaluators, or conditions");
        }
        const dataset = evaluationDatasetSchema.parse((await this.requireSource(plan.datasetVersionId, "dataset")).payload);
        const required = new Set(dataset.cases.map((item) => item.caseId));
        const pairs = run.caseRuns.map((item) => `${item.caseId}:${item.variant}`);
        if (run.caseRuns.length !== required.size * 2 || new Set(pairs).size !== pairs.length ||
          run.caseRuns.some((item) => !required.has(item.caseId) ||
            item.conditionsDigest !== plan.conditionsDigest ||
            item.versionId !== (item.variant === "baseline" ? plan.baselineVersionId : plan.candidateId))) {
          throw new Error("Evaluation run omitted or replaced a frozen dataset case");
        }
      }
      if (input.kind === "safety") {
        const assessment = safetyAssessmentSchema.parse(payload);
        for (const evidenceId of assessment.evidenceIds) {
          const evidence = observationEvidenceSchema.parse((await this.requireSource(evidenceId, "evidence")).payload);
          if (evidence.productSnapshotId !== (parent.payload as { productSnapshotId?: string }).productSnapshotId) {
            throw new Error("Guardian assessment references unrelated product evidence");
          }
        }
      }
      const expectedParent = input.kind === "hypothesis" ? payload.patternId
        : input.kind === "candidate" ? payload.hypothesisId
          : input.kind === "evaluation_plan" || input.kind === "safety" ? payload.candidateId
            : input.kind === "evaluation_run" ? payload.planId
              : input.kind === "comparison" ? payload.runId
              : input.kind === "risk_decision" ? undefined : undefined;
      if (expectedParent && expectedParent !== input.parentRecordId) {
        throw new Error("Lifecycle parent identity does not match the validated output");
      }
    }
    if (payload.executionId && payload.executionId !== input.executionId) {
      throw new Error("Lifecycle execution provenance disagrees with the validated output");
    }
    if (input.kind === "observation" || input.kind === "hypothesis" || input.kind === "candidate" || input.kind === "pattern") {
      const ids = input.kind === "observation" ? payload.evidenceIds as string[]
        : input.kind === "candidate" ? [...payload.evidenceIds as string[], ...payload.counterEvidenceIds as string[]]
          : [...payload.supportEvidenceIds as string[], ...payload.counterEvidenceIds as string[]];
      for (const evidenceId of ids) {
        const { payload: source } = await this.requireSource(evidenceId, "evidence");
        const evidence = observationEvidenceSchema.parse(source);
        if (evidence.productSnapshotId !== payload.productSnapshotId ||
          (payload.productVersionId && evidence.productVersionId !== payload.productVersionId) ||
          (input.kind === "observation" && evidence.executionId && evidence.executionId !== input.executionId)) {
          throw new Error("Lifecycle evidence crosses its product, version, or execution scope");
        }
      }
    }
    if (input.kind === "environment" || input.kind === "pattern") {
      for (const observationId of (input.kind === "environment" ? payload.sourceObservationIds : payload.observationIds) as string[]) {
        const { payload: source } = await this.requireSource(observationId, "observation");
        const observation = observationSchema.parse(source);
        if (observation.productSnapshotId !== payload.productSnapshotId ||
          (payload.productVersionId && observation.productVersionId !== payload.productVersionId)) {
          throw new Error("Lifecycle observation crosses its product snapshot");
        }
      }
    }
    if (input.kind === "evidence") {
      const sourceType = payload.sourceType;
      const table = sourceType === "execution_trace" ? "agent_runtime_trace_events"
        : sourceType === "execution_outcome" || sourceType === "outcome_signal" ? "agent_runtime_outcome_signals"
          : sourceType === "step_outcome" ? "agent_runtime_execution_steps" : null;
      if (!table || !input.executionId) throw new Error("Evidence source has no authoritative runtime binding");
      const column = table === "agent_runtime_trace_events" ? "event_id"
        : table === "agent_runtime_execution_steps" ? "step_attempt_id" : "signal_id";
      const fields = table === "agent_runtime_trace_events" ? "event_id,payload"
        : table === "agent_runtime_execution_steps" ? "step_attempt_id,status" : "signal_id,metric_key,metric_value";
      const { data, error } = await this.client.from(table).select(fields)
        .eq("tenant_id", this.tenantId).eq("execution_id", input.executionId)
        .eq(column, payload.sourceId).single();
      checked(error, "evidence source lookup");
      if (!data) throw new Error("Evidence source is unavailable");
      const row = data as unknown as Record<string, unknown>;
      const sourcePayload = table === "agent_runtime_trace_events" ? row.payload
        : table === "agent_runtime_execution_steps" ? { status: row.status }
          : { metric_key: row.metric_key, metric_value: row.metric_value };
      if (payload.digest !== digest(sourcePayload)) throw new Error("Evidence digest does not match its immutable source");
    }
    if (input.parentRecordId) await this.requireSource(input.parentRecordId);
    if (input.executionId) {
      const { data, error } = await this.client.from("agent_runtime_executions")
        .select("execution_id").eq("tenant_id", this.tenantId).eq("product_key", this.productKey)
        .eq("execution_id", input.executionId).single();
      checked(error, "execution provenance lookup");
      if (!data) throw new Error("Lifecycle execution provenance is missing");
    }
    assertSafeRuntimePayload(payload, 64_000);
    const sourceDigest = digest(payload);
    const { error } = await this.client.from("agent_runtime_lifecycle_records").insert({
      record_id: input.recordId, tenant_id: this.tenantId, product_key: this.productKey,
      record_kind: input.kind, source_execution_id: input.executionId ?? null,
      parent_record_id: input.parentRecordId ?? null,
      source_digest: sourceDigest, payload, occurred_at: input.occurredAt,
    });
    checked(error, "append");
    return sourceDigest;
  }

  async project(input: { sourceId: string; sourceKind: Kind; occurredAt: string }): Promise<void> {
    const source = await this.requireSource(input.sourceId, input.sourceKind);
    let kind: "product" | "learning" | "improvement" | "evaluation" | "safety";
    let payload: z.infer<typeof productSummarySchema | typeof learningSummarySchema | typeof improvementSummarySchema | typeof evaluationSummarySchema | typeof safetySummarySchema>;
    if (input.sourceKind === "product") {
      const context = schemas.product.parse(source.payload) as {
        product: z.infer<typeof productDefinitionSchema>; snapshot: z.infer<typeof productSnapshotSchema>;
        features: z.infer<typeof productFeatureSchema>[]; capabilities: z.infer<typeof productCapabilitySchema>[];
        workflows: z.infer<typeof productWorkflowMetadataSchema>[]; signals: z.infer<typeof outcomeSignalDefinitionSchema>[];
        evaluators: z.infer<typeof productEvaluatorDefinitionSchema>[];
      };
      const { count, error } = await this.client.from("agent_runtime_executions")
        .select("execution_id", { count: "exact", head: true }).eq("tenant_id", this.tenantId)
        .eq("product_key", this.productKey);
      checked(error, "product execution count");
      kind = "product";
      payload = productSummarySchema.parse({
        productKey: context.product.productKey, name: context.product.name,
        productVersionId: context.product.versionId, snapshotId: context.snapshot.productSnapshotId,
        featureCount: context.features.length, capabilityKeys: context.capabilities.map((item) => item.capabilityKey),
        workflowKeys: context.workflows.map((item) => item.workflowKey), signalKeys: context.signals.map((item) => item.signalKey),
        evaluatorKeys: context.evaluators.map((item) => item.evaluatorKey), recentExecutionCount: count ?? 0,
      });
    } else if (["observation", "environment", "pattern", "hypothesis"].includes(input.sourceKind)) {
      const record = schemas[input.sourceKind].parse(source.payload) as Record<string, unknown>;
      const id = input.sourceKind === "observation" ? record.observationId
        : input.sourceKind === "environment" ? record.modelVersionId
          : input.sourceKind === "pattern" ? record.patternId : record.hypothesisId;
      const summary = input.sourceKind === "observation" ? (record.signal as { summary: string }).summary
        : input.sourceKind === "environment" ? `Versioned environment model ${id}`
          : input.sourceKind === "pattern" ? record.decisionSummary : record.problemStatement;
      const evidenceIds = input.sourceKind === "observation" ? record.evidenceIds as string[]
        : input.sourceKind === "environment" ? (await Promise.all((record.sourceObservationIds as string[]).map(async (id) => {
          const observation = observationSchema.parse((await this.requireSource(id, "observation")).payload);
          return observation.evidenceIds;
        }))).flat() : record.supportEvidenceIds as string[];
      const environmentStatus = input.sourceKind === "environment"
        ? (record.entities as Array<{ epistemicStatus: string }>).some((entity) => entity.epistemicStatus === "unknown") ? "unknown"
          : (record.entities as Array<{ epistemicStatus: string }>).some((entity) => entity.epistemicStatus === "hypothesized") ? "hypothesized" : "known"
        : "known";
      kind = "learning";
      payload = learningSummarySchema.parse({ recordId: id, productKey: this.productKey,
        kind: input.sourceKind === "environment" ? "environment_change" : input.sourceKind,
        epistemicStatus: input.sourceKind === "hypothesis" ? "hypothesized"
          : input.sourceKind === "pattern" ? record.epistemicStatus : environmentStatus,
        summary, evidenceIds: [...new Set(evidenceIds)], counterEvidenceIds: record.counterEvidenceIds ?? [],
        uncertainty: input.sourceKind === "hypothesis" ? (record.uncertainties as string[]).join("; ").slice(0, 2_000) : undefined,
        observedAt: input.sourceKind === "observation" ? record.observedAt : input.sourceKind === "hypothesis" ? record.createdAt : input.occurredAt,
      });
    } else if (input.sourceKind === "candidate") {
      const candidate = shadowCandidateSchema.parse(source.payload);
      kind = "improvement";
      payload = improvementSummarySchema.parse({
        candidateId: candidate.candidateId, productKey: candidate.productKey,
        targetComponent: candidate.baseline.targetComponentKey,
        baselineVersionId: candidate.baseline.baselineVersionId,
        objective: candidate.optimizationObjective, boundedChangeSummary: candidate.change.kind,
        risk: candidate.riskClassification, safetyStatus: "not_reviewed",
        lifecycleState: "shadow", executable: false,
      });
    } else if (input.sourceKind === "safety") {
      const assessment = safetyAssessmentSchema.parse(source.payload);
      kind = "safety";
      payload = safetySummarySchema.parse({ productKey: this.productKey,
        assessmentId: assessment.assessmentId, candidateId: assessment.candidateId,
        severity: assessment.severity, guardianDisposition: assessment.recommendedDisposition,
        runtimeDisposition: "pending_deterministic_risk_gate",
        findingSummaries: assessment.findings.map((finding) => finding.summary),
        evidenceIds: assessment.evidenceIds, assessedAt: assessment.assessedAt,
      });
    } else if (input.sourceKind === "risk_decision") {
      const decision = riskGateDecisionSchema.parse(source.payload);
      if (!source.parent_record_id) throw new Error("Risk decision comparison is missing");
      const comparison = comparisonSchema.parse((await this.requireSource(source.parent_record_id, "comparison")).payload);
      const runSource = await this.requireSource(comparison.runId, "evaluation_run");
      const run = evaluationRunSchema.parse(runSource.payload);
      const plan = evaluationPlanSchema.parse((await this.requireSource(run.planId, "evaluation_plan")).payload);
      if (plan.candidateId !== decision.candidateId || run.candidateId !== decision.candidateId ||
        comparison.planId !== plan.planId || comparison.runId !== run.runId) {
        throw new Error("Evaluation, comparison and Risk Gate identities disagree");
      }
      kind = "evaluation";
      payload = evaluationSummarySchema.parse({ productKey: this.productKey,
        evaluationId: comparison.comparisonId, candidateId: decision.candidateId,
        baselineVersionId: plan.baselineVersionId, datasetVersionId: plan.datasetVersionId,
        evaluatorVersionIds: plan.evaluatorVersionIds, status: comparison.status,
        metricSummary: comparison.metrics.map((metric) => ({ key: metric.metricKey,
          baseline: metric.baselineValue, candidate: metric.candidateValue, result: metric.classification })),
        regressionIds: comparison.regressions.map((regression) => regression.regressionId),
        riskGateDecision: decision.decision,
      });
    } else throw new Error("Projection derivation for this source kind is unavailable");
    if (payload.productKey !== this.productKey) throw new Error("Cross-product Control Panel projection rejected");
    assertSafeRuntimePayload(payload, 8_000);
    const { error } = await this.client.from("agent_runtime_control_plane_records").insert({
      record_id: `control:${input.sourceId}`, tenant_id: this.tenantId,
      product_key: this.productKey, record_kind: kind,
      schema_version: "control-plane-snapshot-v1", source_record_id: input.sourceId,
      source_digest: source.source_digest, payload, occurred_at: input.occurredAt,
    });
    checked(error, "projection append");
  }
}
