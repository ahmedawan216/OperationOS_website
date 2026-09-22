import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const safeText = z.string().trim().min(1).max(2_000);
const time = z.string().datetime({ offset: true });
const state = z.enum(["healthy", "attention", "critical", "unknown"]);

export const recordReferenceSchema = z.object({ kind: z.enum(["product", "agent", "execution", "observation", "hypothesis", "candidate", "evaluation", "safety", "approval", "version", "canary"]), id }).strict();
export const healthSummarySchema = z.object({ state, successRate: z.number().min(0).max(1).nullable(), verificationFailures: z.number().int().nonnegative(), retries: z.number().int().nonnegative(), replans: z.number().int().nonnegative(), providerFailures: z.number().int().nonnegative(), openSafetyFindings: z.number().int().nonnegative(), traceStoreHealthy: z.boolean(), measuredAt: time }).strict();
export const productSummarySchema = z.object({ productKey: id, name: safeText, productVersionId: id, snapshotId: id, featureCount: z.number().int().nonnegative(), capabilityKeys: z.array(id).max(1_000), workflowKeys: z.array(id).max(500), signalKeys: z.array(id).max(500), evaluatorKeys: z.array(id).max(500), recentExecutionCount: z.number().int().nonnegative() }).strict();
export const agentSummarySchema = z.object({ agentKey: id, role: z.enum(["manager", "specialist", "optimizer", "guardian"]), versionId: id, status: z.enum(["active", "inactive", "degraded"]), capabilityKeys: z.array(id).max(500), boundarySummary: safeText, recentExecutionCount: z.number().int().nonnegative() }).strict();
export const executionSummarySchema = z.object({ executionId: id, productKey: id, goalSummary: safeText, state: id, agentKeys: z.array(id).max(100), startedAt: time, completedAt: time.optional(), retries: z.number().int().nonnegative(), replans: z.number().int().nonnegative(), verificationStatus: z.enum(["pending", "passed", "failed"]), sanitizedError: safeText.optional(), outcomeSignalKeys: z.array(id).max(100), traceEventCount: z.number().int().nonnegative() }).strict();
export const learningSummarySchema = z.object({ recordId: id, kind: z.enum(["observation", "pattern", "environment_change", "feedback_theme", "hypothesis"]), epistemicStatus: z.enum(["known", "hypothesized", "unknown"]), productKey: id, summary: safeText, evidenceIds: z.array(id).max(1_000), counterEvidenceIds: z.array(id).max(1_000), uncertainty: safeText.optional(), observedAt: time }).strict();
export const improvementSummarySchema = z.object({ candidateId: id, productKey: id, targetComponent: id, baselineVersionId: id, objective: safeText, boundedChangeSummary: safeText, risk: z.enum(["low", "medium", "high"]), safetyStatus: id, lifecycleState: z.enum(["shadow", "evaluating", "rejected", "awaiting_approval", "canary", "promotion_eligible", "rolled_back"]), executable: z.literal(false) }).strict();
export const evaluationSummarySchema = z.object({ evaluationId: id, candidateId: id, baselineVersionId: id, datasetVersionId: id, evaluatorVersionIds: z.array(id).min(1).max(100), status: z.enum(["improved", "regressed", "unchanged", "inconclusive", "invalid"]), metricSummary: z.array(z.object({ key: id, baseline: z.number(), candidate: z.number(), result: id }).strict()).max(100), regressionIds: z.array(id).max(500), riskGateDecision: z.enum(["reject", "inconclusive", "require_human_approval", "canary_eligible"]) }).strict();
export const safetySummarySchema = z.object({ assessmentId: id, candidateId: id, severity: z.enum(["low", "medium", "high"]), guardianDisposition: id, runtimeDisposition: id, findingSummaries: z.array(safeText).max(100), evidenceIds: z.array(id).max(1_000), assessedAt: time }).strict();
export const approvalSummarySchema = z.object({ approvalId: id, actionType: id, subjectId: id, actionDigest: id, payloadSummary: safeText, risk: z.enum(["low", "medium", "high"]), status: z.enum(["pending", "approved", "rejected", "expired", "consumed"]), expiresAt: time, evaluationId: id.optional(), assessmentId: id.optional() }).strict();
export const versionSummarySchema = z.object({ versionId: id, status: z.enum(["known_good", "candidate"]), digest: id, pointer: z.enum(["known_good", "canary", "none"]), createdAt: time }).strict();
export const canarySummarySchema = z.object({ canaryId: id, state: z.enum(["idle", "canary", "rolled_back", "promotion_eligible"]), candidateVersionId: id, knownGoodVersionId: id, rollbackVersionId: id, target: z.enum(["test", "preview"]), allocationPercent: z.number().int().min(1).max(10), productionActivationAllowed: z.literal(false), eventSummaries: z.array(safeText).max(500) }).strict();
export const eventSummarySchema = z.object({ eventId: id, severity: z.enum(["info", "attention", "critical"]), summary: safeText, occurredAt: time, reference: recordReferenceSchema }).strict();

export const controlPlaneSnapshotSchema = z.object({
  contractVersion: z.literal("control-plane-snapshot-v1"),
  generatedAt: time,
  sourceMode: z.enum(["authoritative", "fixture"]),
  products: z.array(productSummarySchema).max(1_000), agents: z.array(agentSummarySchema).max(1_000), executions: z.array(executionSummarySchema).max(10_000),
  learnings: z.array(learningSummarySchema).max(10_000), improvements: z.array(improvementSummarySchema).max(10_000), evaluations: z.array(evaluationSummarySchema).max(10_000),
  safety: z.array(safetySummarySchema).max(10_000), approvals: z.array(approvalSummarySchema).max(10_000), versions: z.array(versionSummarySchema).max(10_000), canaries: z.array(canarySummarySchema).max(1_000),
  health: healthSummarySchema, recentEvents: z.array(eventSummarySchema).max(1_000),
}).strict();

export type ControlPlaneSnapshot = z.infer<typeof controlPlaneSnapshotSchema>;
export type RecordReference = z.infer<typeof recordReferenceSchema>;
