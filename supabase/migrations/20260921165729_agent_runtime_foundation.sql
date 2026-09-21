-- OperationOS agent-runtime Day 1 persistence foundation.
-- These tables are server-only. They remain in public for PostgREST/service-role
-- compatibility, but anon/authenticated receive no grants and RLS is enabled as
-- defense in depth. No client policy is intentionally created.

create schema if not exists agent_runtime_private;
revoke all on schema agent_runtime_private from public, anon, authenticated;

create or replace function agent_runtime_private.reject_immutable_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

revoke all on function agent_runtime_private.reject_immutable_mutation() from public, anon, authenticated;

create table public.agent_runtime_agent_definitions (
  version_id text primary key,
  tenant_id text not null,
  agent_key text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('candidate', 'active', 'retired')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  parent_version_id text references public.agent_runtime_agent_definitions(version_id),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, agent_key, version),
  unique (tenant_id, version_id)
);

create table public.agent_runtime_tool_definitions (
  version_id text primary key,
  tenant_id text not null,
  tool_key text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  side_effect text not null check (side_effect in ('none', 'internal_write', 'external_write', 'destructive')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, tool_key, version_id),
  unique (tenant_id, version_id)
);

create table public.agent_runtime_policy_bundle_versions (
  version_id text primary key,
  tenant_id text not null,
  policy_key text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('candidate', 'active', 'retired')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  parent_version_id text references public.agent_runtime_policy_bundle_versions(version_id),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, policy_key, version),
  unique (tenant_id, version_id)
);

create table public.agent_runtime_deployments (
  deployment_id text primary key,
  tenant_id text not null,
  environment text not null check (environment in ('test', 'preview', 'production')),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  status text not null check (status in ('candidate', 'canary', 'active', 'rolled_back', 'retired')),
  supersedes_deployment_id text references public.agent_runtime_deployments(deployment_id),
  approved_by text,
  created_at timestamptz not null default now(),
  unique (tenant_id, deployment_id)
);

create unique index agent_runtime_one_active_deployment_per_environment
  on public.agent_runtime_deployments (tenant_id, environment)
  where status = 'active';

create table public.agent_runtime_executions (
  execution_id text primary key,
  tenant_id text not null,
  goal_id text not null,
  actor_id text not null,
  idempotency_key text not null,
  goal jsonb not null check (jsonb_typeof(goal) = 'object'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  status text not null check (status in ('queued', 'planning', 'running', 'awaiting_approval', 'verifying', 'succeeded', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, execution_id)
);

create table public.agent_runtime_execution_steps (
  step_attempt_id text primary key,
  tenant_id text not null,
  execution_id text not null,
  step_id text not null,
  attempt integer not null check (attempt > 0),
  retry_of_step_attempt_id text,
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed', 'blocked', 'skipped', 'cancelled')),
  assignment jsonb check (assignment is null or jsonb_typeof(assignment) = 'object'),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (execution_id, step_id, attempt),
  unique (tenant_id, step_attempt_id),
  foreign key (tenant_id, execution_id)
    references public.agent_runtime_executions(tenant_id, execution_id),
  foreign key (tenant_id, retry_of_step_attempt_id)
    references public.agent_runtime_execution_steps(tenant_id, step_attempt_id)
);

create table public.agent_runtime_trace_events (
  event_id text primary key,
  tenant_id text not null,
  execution_id text not null,
  step_attempt_id text,
  sequence bigint not null check (sequence > 0),
  event_type text not null,
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  version_refs jsonb not null default '{}'::jsonb check (jsonb_typeof(version_refs) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  error jsonb check (error is null or jsonb_typeof(error) = 'object'),
  occurred_at timestamptz not null,
  unique (execution_id, sequence),
  foreign key (tenant_id, execution_id)
    references public.agent_runtime_executions(tenant_id, execution_id),
  foreign key (tenant_id, step_attempt_id)
    references public.agent_runtime_execution_steps(tenant_id, step_attempt_id)
);

create table public.agent_runtime_outcome_signals (
  signal_id text primary key,
  tenant_id text not null,
  execution_id text not null,
  step_attempt_id text,
  metric_key text not null,
  metric_value double precision not null,
  unit text not null,
  source text not null check (source in ('runtime', 'deterministic_evaluator', 'model_judge', 'human')),
  evaluator_version_id text,
  recorded_at timestamptz not null,
  foreign key (tenant_id, execution_id)
    references public.agent_runtime_executions(tenant_id, execution_id),
  foreign key (tenant_id, step_attempt_id)
    references public.agent_runtime_execution_steps(tenant_id, step_attempt_id)
);

create table public.agent_runtime_approval_requests (
  approval_id text primary key,
  tenant_id text not null,
  execution_id text,
  candidate_id text,
  requested_by text not null,
  actor_id text not null,
  action_type text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  approval_type text not null check (approval_type in ('human', 'explicit_human')),
  action_digest text not null check (action_digest ~ '^sha256:[a-f0-9]{64}$'),
  summary text not null,
  expires_at timestamptz not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'expired', 'consumed')),
  resolved_by text,
  resolved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (execution_id is not null or candidate_id is not null),
  foreign key (tenant_id, execution_id)
    references public.agent_runtime_executions(tenant_id, execution_id)
);

create index agent_runtime_executions_tenant_created_idx
  on public.agent_runtime_executions (tenant_id, created_at desc);
create index agent_runtime_steps_execution_step_idx
  on public.agent_runtime_execution_steps (execution_id, step_id, attempt);
create index agent_runtime_trace_execution_occurred_idx
  on public.agent_runtime_trace_events (execution_id, occurred_at);
create index agent_runtime_outcomes_execution_metric_idx
  on public.agent_runtime_outcome_signals (execution_id, metric_key);
create index agent_runtime_pending_approvals_idx
  on public.agent_runtime_approval_requests (tenant_id, expires_at)
  where status = 'pending';

create or replace function agent_runtime_private.validate_execution_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.execution_id, new.tenant_id, new.goal_id, new.actor_id, new.idempotency_key, new.goal, new.snapshot, new.created_at)
     is distinct from
     (old.execution_id, old.tenant_id, old.goal_id, old.actor_id, old.idempotency_key, old.goal, old.snapshot, old.created_at) then
    raise exception 'execution identity and snapshot are immutable' using errcode = '55000';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'queued' and new.status in ('planning', 'cancelled')) or
    (old.status = 'planning' and new.status in ('running', 'awaiting_approval', 'failed', 'cancelled')) or
    (old.status = 'running' and new.status in ('awaiting_approval', 'verifying', 'failed', 'cancelled')) or
    (old.status = 'awaiting_approval' and new.status in ('running', 'failed', 'cancelled')) or
    (old.status = 'verifying' and new.status in ('succeeded', 'failed', 'cancelled'))
  ) then
    raise exception 'illegal execution status transition: % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function agent_runtime_private.validate_step_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.step_attempt_id, new.tenant_id, new.execution_id, new.step_id, new.attempt, new.retry_of_step_attempt_id, new.created_at)
     is distinct from
     (old.step_attempt_id, old.tenant_id, old.execution_id, old.step_id, old.attempt, old.retry_of_step_attempt_id, old.created_at) then
    raise exception 'step attempt identity is immutable' using errcode = '55000';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('running', 'skipped', 'cancelled')) or
    (old.status = 'running' and new.status in ('succeeded', 'failed', 'blocked', 'cancelled'))
  ) then
    raise exception 'illegal step status transition: % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger agent_runtime_agent_definitions_immutable
  before update or delete on public.agent_runtime_agent_definitions
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_tool_definitions_immutable
  before update or delete on public.agent_runtime_tool_definitions
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_policy_versions_immutable
  before update or delete on public.agent_runtime_policy_bundle_versions
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_deployments_immutable
  before update or delete on public.agent_runtime_deployments
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_trace_events_append_only
  before update or delete on public.agent_runtime_trace_events
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_outcome_signals_append_only
  before update or delete on public.agent_runtime_outcome_signals
  for each row execute function agent_runtime_private.reject_immutable_mutation();
create trigger agent_runtime_execution_transition_guard
  before update on public.agent_runtime_executions
  for each row execute function agent_runtime_private.validate_execution_transition();
create trigger agent_runtime_step_transition_guard
  before update on public.agent_runtime_execution_steps
  for each row execute function agent_runtime_private.validate_step_transition();

revoke all on function agent_runtime_private.validate_execution_transition() from public, anon, authenticated;
revoke all on function agent_runtime_private.validate_step_transition() from public, anon, authenticated;

alter table public.agent_runtime_agent_definitions enable row level security;
alter table public.agent_runtime_tool_definitions enable row level security;
alter table public.agent_runtime_policy_bundle_versions enable row level security;
alter table public.agent_runtime_deployments enable row level security;
alter table public.agent_runtime_executions enable row level security;
alter table public.agent_runtime_execution_steps enable row level security;
alter table public.agent_runtime_trace_events enable row level security;
alter table public.agent_runtime_outcome_signals enable row level security;
alter table public.agent_runtime_approval_requests enable row level security;

revoke all on table
  public.agent_runtime_agent_definitions,
  public.agent_runtime_tool_definitions,
  public.agent_runtime_policy_bundle_versions,
  public.agent_runtime_deployments,
  public.agent_runtime_executions,
  public.agent_runtime_execution_steps,
  public.agent_runtime_trace_events,
  public.agent_runtime_outcome_signals,
  public.agent_runtime_approval_requests
from public, anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table
  public.agent_runtime_agent_definitions,
  public.agent_runtime_tool_definitions,
  public.agent_runtime_policy_bundle_versions,
  public.agent_runtime_deployments,
  public.agent_runtime_executions,
  public.agent_runtime_execution_steps,
  public.agent_runtime_trace_events,
  public.agent_runtime_outcome_signals,
  public.agent_runtime_approval_requests
to service_role;
