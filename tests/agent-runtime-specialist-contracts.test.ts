import assert from "node:assert/strict";
import { test } from "node:test";

import { agentSystemProposalSchema, workflowModelSchema } from "../lib/agent-runtime/specialist-contracts";
import { requestValidatedAgentSystemProposal, requestValidatedWorkflowModel } from "../lib/agent-runtime/specialist-provider";
import { DeterministicSpecialistProvider } from "../lib/agent-runtime/testing/fake-specialist-provider";
import { ContractValidationError } from "../lib/agent-runtime/validation";
import { architectureInput, architectureProposal, workflowInput, workflowModel } from "./fixtures/specialist-fixtures";

test("valid WorkflowModel preserves facts, assumptions, and unknowns as distinct structures", () => {
  const parsed = workflowModelSchema.parse(workflowModel());
  assert.equal(parsed.status, "draft");
  assert.equal(parsed.facts[0]?.factId, "fact-human-review");
  assert.equal(parsed.assumptions[0]?.assumptionId, "assumption-format");
  assert.equal(parsed.unknowns[0]?.unknownId, "unknown-volume");
  assert.equal(parsed.successCriteria.length, 1);
});

test("malformed, extra-field, and invalid-reference WorkflowModels are rejected", () => {
  assert.equal(workflowModelSchema.safeParse({ workflowId: "incomplete" }).success, false);
  assert.equal(workflowModelSchema.safeParse({ ...workflowModel(), hiddenReasoning: "forbidden" }).success, false);
  const dependency = workflowModel();
  dependency.stages[0]!.dependsOnStageIds = ["missing-stage"];
  assert.equal(workflowModelSchema.safeParse(dependency).success, false);
  const evidence = workflowModel();
  evidence.facts[0]!.evidenceRefs = ["fabricated-evidence"];
  assert.equal(workflowModelSchema.safeParse(evidence).success, false);
  const outputEvidence = workflowModel();
  outputEvidence.outputs[0]!.evidenceRefs = ["fabricated-evidence"];
  assert.equal(workflowModelSchema.safeParse(outputEvidence).success, false);
  const checkpoint = workflowModel();
  checkpoint.humanCheckpoints[0]!.stageId = "missing-stage";
  assert.equal(workflowModelSchema.safeParse(checkpoint).success, false);
});

test("cyclic workflow stage dependencies are rejected", () => {
  const cyclic = workflowModel();
  cyclic.stages.push({
    ...structuredClone(cyclic.stages[0]!), stageId: "stage-finalize", name: "Finalize",
    dependsOnStageIds: ["stage-review"], humanCheckpointIds: [],
  });
  cyclic.stages[0]!.dependsOnStageIds = ["stage-finalize"];
  assert.equal(workflowModelSchema.safeParse(cyclic).success, false);
});

test("valid AgentSystemProposal is accepted while invalid handoffs and approvals are rejected", () => {
  assert.equal(agentSystemProposalSchema.safeParse(architectureProposal()).success, true);
  const handoff = architectureProposal();
  handoff.handoffs = [{
    handoffId: "handoff-invalid", fromAgentId: "proposed-reviewer", toAgentId: "missing-agent",
    condition: "Always", contextBoundaryId: "boundary-review", outputContract: "review.output.v1",
  }];
  assert.equal(agentSystemProposalSchema.safeParse(handoff).success, false);
  const approval = architectureProposal();
  approval.approvalRequirements[0]!.approvalType = "human";
  assert.equal(agentSystemProposalSchema.safeParse(approval).success, false);

  const wrongBoundaryOwner = architectureProposal();
  wrongBoundaryOwner.agents.push({
    ...structuredClone(wrongBoundaryOwner.agents[0]!), proposedAgentId: "proposed-recorder", name: "Recorder",
    inputContextBoundaryIds: ["boundary-recorder"], outputContextBoundaryIds: ["boundary-recorder"],
  });
  wrongBoundaryOwner.contextBoundaries.push({
    ...structuredClone(wrongBoundaryOwner.contextBoundaries[0]!),
    boundaryId: "boundary-recorder", ownerAgentId: "proposed-recorder",
  });
  wrongBoundaryOwner.handoffs = [{
    handoffId: "handoff-wrong-boundary", fromAgentId: "proposed-reviewer", toAgentId: "proposed-recorder",
    condition: "After review", contextBoundaryId: "boundary-recorder", outputContract: "review.output.v1",
  }];
  assert.equal(agentSystemProposalSchema.safeParse(wrongBoundaryOwner).success, false);
});

test("specialist provider boundaries validate structured output before acceptance", async () => {
  const provider = new DeterministicSpecialistProvider({
    workflow: [{ kind: "response", response: { output: workflowModel(), usage: { costUsd: 0.01 } } }],
    architecture: [{ kind: "response", response: { output: architectureProposal() } }],
  });
  const workflow = await requestValidatedWorkflowModel(provider, workflowInput());
  const architecture = await requestValidatedAgentSystemProposal(provider, architectureInput());
  assert.equal(workflow.model.workflowId, "workflow-1");
  assert.equal(workflow.usage?.costUsd, 0.01);
  assert.equal(architecture.proposal.proposalId, "proposal-1");
});

test("untrusted specialist provider output with forbidden fields is rejected", async () => {
  const provider = new DeterministicSpecialistProvider({
    workflow: [{ kind: "response", response: { output: { ...workflowModel(), deployNow: true } } }],
  });
  await assert.rejects(requestValidatedWorkflowModel(provider, workflowInput()), ContractValidationError);
});
