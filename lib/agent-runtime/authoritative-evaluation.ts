import "server-only";

import type { EvaluationExecutor } from "./evaluation-engine";
import { executeEvaluation } from "./evaluation-engine";
import { EvaluationRegistry } from "./evaluation-registry";
import type { EvaluationPlan } from "./evaluation-contracts";
import { evaluationDatasetSchema, evaluatorDefinitionV2Schema } from "./evaluation-contracts";
import type { AuthoritativeLifecycleWriter } from "./authoritative-lifecycle";

/** Independent evaluation consumes immutable registered inputs and checkpoints
 * every output before advancing to comparison or the deterministic Risk Gate. */
export async function runAuthoritativeEvaluation(input: {
  writer: AuthoritativeLifecycleWriter;
  executionId: string;
  candidateId: string;
  plan: EvaluationPlan;
  executor: EvaluationExecutor;
  runId: string;
  comparisonId: string;
  assessmentId: string;
  target: "test" | "preview";
  startedAt: string;
  completedAt: string;
  approval?: { approvalId: string; actorId: string };
}) {
  const candidate = await input.writer.requireSource(input.candidateId, "candidate");
  if (input.plan.candidateId !== input.candidateId || input.plan.candidateDigest !== candidate.source_digest) {
    throw new Error("Evaluation plan does not bind the immutable candidate source");
  }
  if (input.plan.guardianAssessmentId !== input.assessmentId) {
    throw new Error("Evaluation Guardian assessment differs from the frozen plan");
  }
  const registry = new EvaluationRegistry();
  const dataset = registry.registerDataset(evaluationDatasetSchema.parse(
    (await input.writer.requireSource(input.plan.datasetVersionId, "dataset")).payload));
  for (const id of input.plan.evaluatorVersionIds) {
    registry.registerEvaluator(evaluatorDefinitionV2Schema.parse((await input.writer.requireSource(id, "evaluator")).payload));
  }
  const plan = registry.freezePlan(input.plan);
  await input.writer.append({ kind: "evaluation_plan", recordId: plan.planId,
    executionId: input.executionId, parentRecordId: input.candidateId, payload: plan, occurredAt: input.startedAt });
  const run = await executeEvaluation({ runId: input.runId, plan, dataset,
    evaluators: input.plan.evaluatorVersionIds.map((id) => registry.evaluator(id)),
    executor: input.executor, startedAt: input.startedAt, completedAt: input.completedAt });
  await input.writer.append({ kind: "evaluation_run", recordId: run.runId,
    executionId: input.executionId, parentRecordId: plan.planId, payload: run, occurredAt: input.completedAt });
  const comparison = await input.writer.compareAndPersist({ comparisonId: input.comparisonId,
    executionId: input.executionId, runId: run.runId, occurredAt: input.completedAt });
  const decision = await input.writer.decideRisk({ executionId: input.executionId,
    candidateId: input.candidateId, comparisonId: comparison.comparisonId,
    assessmentId: input.assessmentId, deploymentTarget: input.target, occurredAt: input.completedAt,
    approval: input.approval });
  await input.writer.project({ sourceId: `risk:${input.candidateId}:${comparison.comparisonId}${decision.approvalConsumedId ? `:${decision.approvalConsumedId}` : ""}`,
    sourceKind: "risk_decision", occurredAt: input.completedAt });
  return { run, comparison, decision };
}
