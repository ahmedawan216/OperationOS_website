-- A canary transition checkpoints its immutable source, sanitized projection
-- and non-production deployment in one transaction. No production target exists.
create or replace function public.agent_runtime_start_nonproduction_canary(
  p_tenant_id text, p_product_key text, p_execution_id text,
  p_risk_record_id text, p_config jsonb, p_source_digest text,
  p_projection jsonb, p_started_at timestamptz
)
returns table (canary_id text, state text)
language plpgsql security definer set search_path = ''
as $$
declare
  risk_record public.agent_runtime_lifecycle_records%rowtype;
  candidate_record public.agent_runtime_lifecycle_records%rowtype;
  good public.agent_runtime_deployments%rowtype;
  approval text;
begin
  if p_config ->> 'target' not in ('test', 'preview')
     or (p_config ->> 'allocationPercent')::integer not between 1 and 10
     or (p_config ->> 'maxDurationMs')::integer not between 1 and 86400000
     or p_config ->> 'knownGoodVersionId' is distinct from p_config ->> 'rollbackVersionId'
     or p_projection ->> 'state' <> 'canary'
     or p_projection ->> 'productionActivationAllowed' <> 'false'
     or p_projection ->> 'canaryId' is distinct from p_config ->> 'canaryId'
     or p_projection ->> 'candidateVersionId' is distinct from p_config ->> 'candidateVersionId'
     or p_projection ->> 'rollbackVersionId' is distinct from p_config ->> 'rollbackVersionId'
     or p_projection ->> 'conditionsDigest' is distinct from p_config ->> 'conditionsDigest'
     or p_projection ->> 'target' is distinct from p_config ->> 'target'
     or (p_projection ->> 'allocationPercent')::integer is distinct from (p_config ->> 'allocationPercent')::integer
     or p_source_digest !~ '^sha256:[a-f0-9]{64}$'
     or (p_config ->> 'createdAt')::timestamptz is distinct from p_started_at then
    raise exception 'non-production canary configuration is invalid' using errcode = '23514';
  end if;

  select * into risk_record from public.agent_runtime_lifecycle_records
    where tenant_id = p_tenant_id and product_key = p_product_key
      and record_id = p_risk_record_id and source_execution_id = p_execution_id
      and record_kind = 'risk_decision' and payload ->> 'decision' = 'canary_eligible'
      and payload ->> 'active' = 'false';
  if not found then raise exception 'no authorized deterministic Risk Gate source' using errcode = 'P0001'; end if;
  select * into candidate_record from public.agent_runtime_lifecycle_records
    where tenant_id = p_tenant_id and product_key = p_product_key
      and record_id = risk_record.payload ->> 'candidateId' and record_kind = 'candidate';
  if not found or candidate_record.record_id is distinct from p_config ->> 'candidateVersionId'
     or candidate_record.payload -> 'baseline' ->> 'baselineVersionId' is distinct from p_config ->> 'knownGoodVersionId'
     or candidate_record.payload ->> 'productKey' is distinct from p_product_key then
    raise exception 'canary version does not bind the immutable candidate and baseline' using errcode = 'P0001';
  end if;
  approval := risk_record.payload ->> 'approvalConsumedId';
  if approval is not null and not exists (
    select 1 from public.agent_runtime_approval_requests a
     where a.tenant_id = p_tenant_id and a.product_key = p_product_key
       and a.execution_id = p_execution_id and a.candidate_id = candidate_record.record_id
       and a.approval_id = approval and a.status = 'consumed'
       and a.action_type = 'start_canary'
       and a.action_digest = risk_record.payload ->> 'authorizedActionDigest'
  ) then raise exception 'human approval was not consumed for this canary' using errcode = 'P0001'; end if;

  select * into good from public.agent_runtime_deployments
   where tenant_id = p_tenant_id and product_key = p_product_key
     and environment = p_config ->> 'target'
     and deployment_id = p_config ->> 'knownGoodVersionId' and status = 'active'
   for update;
  if not found or good.manifest ->> 'digest' is distinct from candidate_record.payload -> 'baseline' ->> 'baselineDigest' then
    raise exception 'exact immutable known-good version is unavailable' using errcode = 'P0001';
  end if;
  insert into public.agent_runtime_lifecycle_records (
    record_id, tenant_id, product_key, record_kind, source_execution_id,
    parent_record_id, source_digest, payload, occurred_at
  ) values (
    p_config ->> 'canaryId', p_tenant_id, p_product_key, 'canary', p_execution_id,
    p_risk_record_id, p_source_digest, p_config, p_started_at
  );
  insert into public.agent_runtime_control_plane_records (
    record_id, tenant_id, product_key, record_kind, schema_version,
    source_record_id, source_digest, payload, occurred_at
  ) values (
    'control:' || (p_config ->> 'canaryId'), p_tenant_id, p_product_key, 'canary',
    'control-plane-snapshot-v1', p_config ->> 'canaryId', p_source_digest, p_projection, p_started_at
  );
  insert into public.agent_runtime_deployments (
    deployment_id, tenant_id, product_key, environment, manifest, risk_level,
    status, supersedes_deployment_id, approved_by, created_at
  ) values (
    candidate_record.record_id, p_tenant_id, p_product_key, p_config ->> 'target',
    jsonb_build_object('candidateId', candidate_record.record_id, 'digest', candidate_record.source_digest),
    candidate_record.payload ->> 'riskClassification', 'canary', good.deployment_id,
    case when approval is null then null else
      (select actor_id from public.agent_runtime_approval_requests where approval_id = approval) end,
    p_started_at
  );
  return query select p_config ->> 'canaryId', 'canary'::text;
end;
$$;
revoke all on function public.agent_runtime_start_nonproduction_canary(text,text,text,text,jsonb,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.agent_runtime_start_nonproduction_canary(text,text,text,text,jsonb,text,jsonb,timestamptz) to service_role;
