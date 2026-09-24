# Controlled production proof: integration gate

Checked on 2026-09-24 against `40d0dcf3f068f25c9164686f1c70e853984d7275`.

**Status: blocked before authoritative writes.** The production proof must not use
fixture data or manually insert Control Panel projection rows.

## Verified boundaries

- `AgentRuntimeService` and `ManagerOrchestrationService` operate on synchronous
  in-memory repositories, execution states, attempts, and event sinks.
- `AgentRuntimePersistence` is an interface only; there is no implementation or
  invocation that commits Manager, specialist, observation, candidate, evaluation,
  or canary records to the database.
- The Control Panel Supabase repository reads authoritative runtime tables and
  projection records. Its only write integration is the existing restricted
  approval and non-production rollback governance RPCs.
- The Supabase project with the `agent_runtime_foundation` and
  `control_plane_authoritative_records` migrations has zero executions,
  registered agents, deployments, approvals, and projection records as of this
  check. Migration identity alone does not establish which Supabase project the
  Vercel production environment uses; that binding needs independent verification
  before a write.
- The deployed Vercel production commit matches the inspected main commit.

## Required before a controlled persisted run

1. Verify the production Supabase project and tenant binding without disclosing
   credential values. Verify the schema and product isolation for that tenant.
2. Implement and test a domain-owned persistence adapter for the existing
   `AgentRuntimePersistence` boundary, including transactional execution state,
   ordered redacted traces, attempts, outcomes, and idempotency. Connect the
   Manager and specialists through that adapter without granting them write
   authority over policy or deployment pointers.
3. Persist versioned product context, observations, hypotheses, candidates,
   immutable evaluation inputs and results, and Safety Guardian and Risk Gate
   decisions from validated domain outputs. Derive sanitized Control Panel
   projections from committed source records, not from manually authored rows.
4. Run the harmless founder-controlled goal through those wired APIs. Only then
   consider the exact-bound approval and permitted non-production canary path.

Until those gates are met, unit/integration fixtures establish contract behavior
but **do not establish an operational production lifecycle**. No production
records, approvals, deployments, or DNS settings were changed for this check.
