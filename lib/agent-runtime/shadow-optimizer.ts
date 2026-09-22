import "server-only";

import { shadowCandidateSchema, optimizerRequestSchema, type OptimizerRequest, type ShadowCandidate } from "./optimizer-contracts";
import { parseContract } from "./validation";
import { LearningProviderError } from "./learning-errors";

export interface ShadowOptimizerProvider {
  proposeCandidate(request: OptimizerRequest): Promise<{ readonly output: unknown }>;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function validateBoundedChange(candidate: ShadowCandidate, request: OptimizerRequest): void {
  const change = candidate.change;
  if (change.kind === "prompt_patch" || change.kind === "model_policy_patch") {
    if (!request.allowedAgentKeys.includes(change.agentKey)) throw new Error(`Optimizer targeted an unavailable agent: ${change.agentKey}`);
  }
  if (change.kind === "model_policy_patch" && change.changes.allowedModelKeys) {
    for (const modelKey of change.changes.allowedModelKeys) if (!request.allowedModelKeys.includes(modelKey)) throw new Error(`Optimizer selected an unapproved model: ${modelKey}`);
  }
  if (change.kind === "routing_rule_patch") {
    for (const rule of change.changes) if (!request.allowedAgentKeys.includes(rule.assignedAgentKey)) throw new Error(`Optimizer routed to an unavailable agent: ${rule.assignedAgentKey}`);
  }
  if (change.kind === "approved_tool_selection_patch") {
    for (const toolKey of change.toolKeys) if (!request.allowedToolKeys.includes(toolKey)) throw new Error(`Optimizer selected an unapproved tool: ${toolKey}`);
  }
}

export async function requestValidatedShadowCandidate(input: {
  provider: ShadowOptimizerProvider;
  request: OptimizerRequest;
}): Promise<ShadowCandidate> {
  const request = parseContract(optimizerRequestSchema, input.request, "shadow-optimizer.request");
  let response: { readonly output: unknown };
  try {
    response = await input.provider.proposeCandidate(request);
  } catch {
    throw new LearningProviderError("Shadow optimizer");
  }
  const candidate = parseContract(shadowCandidateSchema, response.output, "shadow-optimizer.response");
  if (candidate.candidateId !== request.candidateId || candidate.candidateVersion !== request.candidateVersion || candidate.parentCandidateId !== request.parentCandidateId) throw new Error("Optimizer changed runtime-owned candidate identity");
  if (candidate.hypothesisId !== request.hypothesis.hypothesisId || candidate.productKey !== request.hypothesis.productKey || candidate.productSnapshotId !== request.hypothesis.productSnapshotId) throw new Error("Optimizer changed hypothesis or product context");
  if (JSON.stringify(candidate.baseline) !== JSON.stringify(request.baseline)) throw new Error("Optimizer changed immutable baseline");
  if (candidate.optimizationObjective !== request.optimizationObjective) throw new Error("Optimizer changed its optimization objective");
  if (candidate.expectedOutcomeSignalKey !== request.hypothesis.expectedOutcomeSignalKey) throw new Error("Optimizer changed the expected outcome signal");
  if (candidate.riskClassification !== request.requiredRiskLevel) throw new Error("Optimizer changed runtime-owned risk classification");
  if (!sameStrings(candidate.evidenceIds, request.hypothesis.supportEvidenceIds)) throw new Error("Optimizer altered supporting evidence");
  if (!sameStrings(candidate.counterEvidenceIds, request.hypothesis.counterEvidenceIds)) throw new Error("Optimizer hid or altered counter-evidence");
  if (JSON.stringify(candidate.evaluationRequirements) !== JSON.stringify(request.evaluationRequirements)) throw new Error("Optimizer changed independent evaluation requirements");
  validateBoundedChange(candidate, request);
  return deepFreeze(structuredClone(candidate));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export class ShadowCandidateRegistry {
  private readonly candidates = new Map<string, ShadowCandidate>();

  register(candidate: ShadowCandidate): ShadowCandidate {
    const validated = shadowCandidateSchema.parse(candidate);
    if (this.candidates.has(validated.candidateId)) throw new Error(`Candidate already finalized: ${validated.candidateId}`);
    if (validated.candidateVersion === 1 && validated.parentCandidateId) throw new Error("Initial candidate cannot have a parent");
    if (validated.candidateVersion > 1) {
      const parent = validated.parentCandidateId && this.candidates.get(validated.parentCandidateId);
      if (!parent || validated.candidateVersion !== parent.candidateVersion + 1) throw new Error("Candidate version requires an immutable sequential parent");
    }
    const stored = deepFreeze(structuredClone(validated));
    this.candidates.set(stored.candidateId, stored);
    return stored;
  }
}

export class DeterministicShadowOptimizerProvider implements ShadowOptimizerProvider {
  constructor(private readonly change: ShadowCandidate["change"]) {}

  async proposeCandidate(request: OptimizerRequest): Promise<{ readonly output: unknown }> {
    return {
      output: {
        contractVersion: "shadow-candidate-v1",
        candidateId: request.candidateId,
        candidateVersion: request.candidateVersion,
        ...(request.parentCandidateId ? { parentCandidateId: request.parentCandidateId } : {}),
        status: "shadow",
        executable: false,
        activationAllowed: false,
        finalized: true,
        hypothesisId: request.hypothesis.hypothesisId,
        productKey: request.hypothesis.productKey,
        productSnapshotId: request.hypothesis.productSnapshotId,
        baseline: request.baseline,
        optimizationObjective: request.optimizationObjective,
        change: this.change,
        evidenceIds: request.hypothesis.supportEvidenceIds,
        counterEvidenceIds: request.hypothesis.counterEvidenceIds,
        expectedOutcomeSignalKey: request.hypothesis.expectedOutcomeSignalKey,
        expectedMeasurableEffect: "Reduce the fixed failure metric without regressing independent safety metrics.",
        evaluationRequirements: request.evaluationRequirements,
        riskClassification: request.requiredRiskLevel,
        rollbackBaselineVersionId: request.baseline.baselineVersionId,
        decisionSummary: "Proposes one bounded shadow-only change for independent evaluation.",
        createdAt: request.createdAt,
      },
    };
  }
}
