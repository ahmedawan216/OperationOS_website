import "server-only";
import { evaluationDatasetSchema, evaluationPlanSchema, evaluatorDefinitionV2Schema, type EvaluationDataset, type EvaluationPlan, type EvaluatorDefinitionV2 } from "./evaluation-contracts";

function freeze<T>(value: T): T { const copy = structuredClone(value); const walk=(v:unknown):void=>{if(!v||typeof v!=="object"||Object.isFrozen(v))return; for(const x of Object.values(v))walk(x); Object.freeze(v);}; walk(copy); return copy; }

export class EvaluationRegistry {
  readonly #datasets = new Map<string, EvaluationDataset>();
  readonly #evaluators = new Map<string, EvaluatorDefinitionV2>();
  readonly #plans = new Map<string, EvaluationPlan>();
  registerDataset(input: unknown): EvaluationDataset { const value=evaluationDatasetSchema.parse(input); if(this.#datasets.has(value.datasetVersionId))throw new Error("Dataset version is immutable"); const stored=freeze(value); this.#datasets.set(value.datasetVersionId,stored); return stored; }
  registerEvaluator(input: unknown): EvaluatorDefinitionV2 { const value=evaluatorDefinitionV2Schema.parse(input); if(this.#evaluators.has(value.evaluatorVersionId))throw new Error("Evaluator version is immutable"); const stored=freeze(value); this.#evaluators.set(value.evaluatorVersionId,stored); return stored; }
  freezePlan(input: unknown): EvaluationPlan { const value=evaluationPlanSchema.parse(input); if(this.#plans.has(value.planId))throw new Error("Evaluation plan is immutable"); const dataset=this.#datasets.get(value.datasetVersionId); if(!dataset||dataset.digest!==value.datasetDigest)throw new Error("Plan dataset reference is unresolved or changed"); if(dataset.productKey!==value.productKey||dataset.productSnapshotId!==value.productSnapshotId)throw new Error("Plan dataset crosses product context"); for(const evaluatorId of value.evaluatorVersionIds)if(!this.#evaluators.has(evaluatorId))throw new Error(`Unapproved evaluator: ${evaluatorId}`); if(value.budgets.maxCases!==dataset.cases.length)throw new Error("Frozen plan must include every dataset case"); const stored=freeze(value); this.#plans.set(value.planId,stored); return stored; }
  dataset(id:string){const value=this.#datasets.get(id);if(!value)throw new Error(`Unknown dataset: ${id}`);return value;}
  evaluator(id:string){const value=this.#evaluators.get(id);if(!value)throw new Error(`Unknown evaluator: ${id}`);return value;}
  plan(id:string){const value=this.#plans.get(id);if(!value)throw new Error(`Unknown evaluation plan: ${id}`);return value;}
}
