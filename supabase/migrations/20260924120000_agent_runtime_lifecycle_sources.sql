-- Immutable source records for validated runtime/learning/evaluation outputs.
-- Projections can only be inserted against a committed source with the same
-- tenant, product, source identifier and digest. No public access is granted.

create unique index if not exists agent_runtime_executions_product_identity_idx
  on public.agent_runtime_executions (tenant_id, product_key, execution_id);

create table public.agent_runtime_lifecycle_records (
  record_id text primary key,
  tenant_id text not null,
  product_key text not null,
  record_kind text not null check (record_kind in (
    'product', 'evidence', 'observation', 'environment', 'pattern', 'hypothesis',
    'candidate', 'dataset', 'evaluator', 'evaluation_plan', 'evaluation_run', 'comparison', 'safety',
    'risk_decision', 'canary'
  )),
  source_execution_id text,
  parent_record_id text,
  source_digest text not null check (source_digest ~ '^sha256:[a-f0-9]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, product_key, record_id),
  unique (tenant_id, product_key, record_id, source_digest),
  foreign key (tenant_id, product_key, source_execution_id)
    references public.agent_runtime_executions(tenant_id, product_key, execution_id),
  foreign key (tenant_id, product_key, parent_record_id)
    references public.agent_runtime_lifecycle_records(tenant_id, product_key, record_id),
  check (record_kind = 'product' or (record_kind in ('dataset', 'evaluator') and parent_record_id is not null)
    or (source_execution_id is not null and parent_record_id is not null)),
  check (parent_record_id is null or parent_record_id <> record_id)
);

create index agent_runtime_lifecycle_product_kind_idx
  on public.agent_runtime_lifecycle_records (tenant_id, product_key, record_kind, occurred_at desc);

create trigger agent_runtime_lifecycle_records_append_only
  before update or delete on public.agent_runtime_lifecycle_records
  for each row execute function agent_runtime_private.reject_immutable_mutation();

alter table public.agent_runtime_lifecycle_records enable row level security;
revoke all on table public.agent_runtime_lifecycle_records from public, anon, authenticated;
grant select, insert on table public.agent_runtime_lifecycle_records to service_role;

-- Existing rows are not retroactively declared sourced. Every newly inserted
-- projection must resolve to an immutable, same-product source record.
alter table public.agent_runtime_control_plane_records
  add constraint agent_runtime_control_projection_source_fk
  foreign key (tenant_id, product_key, source_record_id, source_digest)
  references public.agent_runtime_lifecycle_records(tenant_id, product_key, record_id, source_digest)
  not valid;
