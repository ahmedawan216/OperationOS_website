-- Server-only authoritative Control Plane read records.
-- These immutable records reference their authoritative source and never grant
-- runtime, approval, policy, or deployment authority.

alter table public.agent_runtime_executions add column if not exists product_key text;
update public.agent_runtime_executions set product_key = tenant_id where product_key is null;
alter table public.agent_runtime_executions alter column product_key set not null;

alter table public.agent_runtime_approval_requests add column if not exists product_key text;
update public.agent_runtime_approval_requests set product_key = tenant_id where product_key is null;
alter table public.agent_runtime_approval_requests alter column product_key set not null;

alter table public.agent_runtime_deployments add column if not exists product_key text;
update public.agent_runtime_deployments set product_key = tenant_id where product_key is null;
alter table public.agent_runtime_deployments alter column product_key set not null;

create index if not exists agent_runtime_executions_product_created_idx
  on public.agent_runtime_executions (tenant_id, product_key, created_at desc);
create index if not exists agent_runtime_approvals_product_created_idx
  on public.agent_runtime_approval_requests (tenant_id, product_key, created_at desc);
create index if not exists agent_runtime_deployments_product_created_idx
  on public.agent_runtime_deployments (tenant_id, product_key, created_at desc);

create table if not exists public.agent_runtime_control_plane_records (
  record_id text primary key,
  tenant_id text not null,
  product_key text not null,
  record_kind text not null check (record_kind in (
    'product', 'learning', 'improvement', 'evaluation', 'safety', 'canary', 'event'
  )),
  schema_version text not null check (schema_version = 'control-plane-snapshot-v1'),
  source_record_id text not null,
  source_digest text not null check (source_digest ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, record_kind, source_record_id, source_digest),
  unique (tenant_id, record_id)
);

create index if not exists agent_runtime_control_records_product_idx
  on public.agent_runtime_control_plane_records (tenant_id, product_key, record_kind, occurred_at desc);

create trigger agent_runtime_control_plane_records_append_only
  before update or delete on public.agent_runtime_control_plane_records
  for each row execute function agent_runtime_private.reject_immutable_mutation();

alter table public.agent_runtime_control_plane_records enable row level security;
revoke all on table public.agent_runtime_control_plane_records from public, anon, authenticated;
grant select, insert on table public.agent_runtime_control_plane_records to service_role;

-- Product identity is part of the immutable execution and approval binding.
create or replace function agent_runtime_private.validate_execution_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.execution_id, new.tenant_id, new.product_key, new.goal_id, new.actor_id, new.idempotency_key, new.goal, new.snapshot, new.created_at)
     is distinct from
     (old.execution_id, old.tenant_id, old.product_key, old.goal_id, old.actor_id, old.idempotency_key, old.goal, old.snapshot, old.created_at) then
    raise exception 'execution identity and snapshot are immutable' using errcode = '55000';
  end if;
  if new.status = old.status then return new; end if;
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

create or replace function agent_runtime_private.validate_approval_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.approval_id, new.tenant_id, new.product_key, new.execution_id, new.candidate_id, new.requested_by,
      new.actor_id, new.action_type, new.risk_level, new.approval_type, new.action_digest,
      new.summary, new.expires_at, new.created_at)
     is distinct from
     (old.approval_id, old.tenant_id, old.product_key, old.execution_id, old.candidate_id, old.requested_by,
      old.actor_id, old.action_type, old.risk_level, old.approval_type, old.action_digest,
      old.summary, old.expires_at, old.created_at) then
    raise exception 'approval identity and action binding are immutable' using errcode = '55000';
  end if;
  if new.status = old.status then
    if (new.resolved_by, new.resolved_at, new.consumed_at) is distinct from (old.resolved_by, old.resolved_at, old.consumed_at) then
      raise exception 'approval resolution metadata cannot change without a status transition' using errcode = '23514';
    end if;
    return new;
  end if;
  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'expired')) or
    (old.status = 'approved' and new.status in ('consumed', 'expired'))
  ) then
    raise exception 'illegal approval status transition: % -> %', old.status, new.status using errcode = '23514';
  end if;
  if new.status in ('approved', 'rejected') and (new.resolved_by is null or new.resolved_at is null) then
    raise exception 'resolved approvals require resolver metadata' using errcode = '23514';
  end if;
  if new.status = 'consumed' and new.consumed_at is null then
    raise exception 'consumed approvals require consumed_at' using errcode = '23514';
  end if;
  return new;
end;
$$;
