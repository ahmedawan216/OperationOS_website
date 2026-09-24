-- Append measured canary outcome and deployment history; never activate production.
alter table public.agent_runtime_lifecycle_records
  drop constraint agent_runtime_lifecycle_records_record_kind_check;
alter table public.agent_runtime_lifecycle_records
  add constraint agent_runtime_lifecycle_records_record_kind_check check (record_kind in (
    'product', 'evidence', 'observation', 'environment', 'pattern', 'hypothesis',
    'candidate', 'dataset', 'evaluator', 'evaluation_plan', 'evaluation_run',
    'comparison', 'safety', 'risk_decision', 'canary', 'canary_monitor'
  ));

create or replace function public.agent_runtime_finish_nonproduction_canary(
  p_tenant_id text, p_product_key text, p_canary_id text,
  p_event_id text, p_result jsonb, p_source_digest text,
  p_projection jsonb, p_completed_at timestamptz
)
returns table (event_id text, state text)
language plpgsql security definer set search_path = ''
as $$
declare
  source public.agent_runtime_lifecycle_records%rowtype;
  deployment public.agent_runtime_deployments%rowtype;
  signal_value double precision;
  success_value double precision;
  safety_value double precision;
  metric record;
  breach boolean;
begin
  select * into source from public.agent_runtime_lifecycle_records
   where tenant_id = p_tenant_id and product_key = p_product_key
     and record_id = p_canary_id and record_kind = 'canary';
  if not found or source.payload ->> 'target' not in ('test', 'preview')
     or p_completed_at < source.occurred_at
     or p_result ->> 'canaryId' is distinct from p_canary_id
     or p_result ->> 'rerunExecutionId' is null
     or p_result ->> 'rerunExecutionId' = source.source_execution_id
     or p_result ->> 'state' not in ('rolled_back', 'promotion_eligible')
     or p_projection ->> 'state' is distinct from p_result ->> 'state'
     or p_projection ->> 'productKey' is distinct from p_product_key
     or p_projection ->> 'canaryId' is distinct from p_canary_id
     or p_projection ->> 'candidateVersionId' is distinct from source.payload ->> 'candidateVersionId'
     or p_projection ->> 'rollbackVersionId' is distinct from source.payload ->> 'rollbackVersionId'
     or p_projection ->> 'knownGoodVersionId' is distinct from source.payload ->> 'knownGoodVersionId'
     or p_projection ->> 'target' is distinct from source.payload ->> 'target'
     or (p_projection ->> 'allocationPercent')::integer is distinct from (source.payload ->> 'allocationPercent')::integer
     or p_projection ->> 'conditionsDigest' is distinct from source.payload ->> 'conditionsDigest'
     or p_projection ->> 'productionActivationAllowed' <> 'false'
     or p_source_digest !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'canary monitor source or terminal state is invalid' using errcode = '23514';
  end if;
  select * into deployment from public.agent_runtime_deployments
   where tenant_id = p_tenant_id and product_key = p_product_key
     and deployment_id = source.payload ->> 'candidateVersionId'
     and status = 'canary' and environment = source.payload ->> 'target'
   for update;
  if not found or exists (
    select 1 from public.agent_runtime_lifecycle_records
    where tenant_id = p_tenant_id and product_key = p_product_key
      and parent_record_id = p_canary_id and record_kind = 'canary_monitor'
  ) then raise exception 'canary is unavailable or already terminal' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.agent_runtime_executions e
    where e.tenant_id = p_tenant_id and e.product_key = p_product_key
      and e.execution_id = p_result ->> 'rerunExecutionId'
      and e.status in ('succeeded', 'failed')) then
    raise exception 'canary rerun is not a terminal same-product execution' using errcode = 'P0001';
  end if;

  -- Every measurement is an independently persisted runtime/evaluator signal
  -- from the bounded rerun, never a caller supplied number without evidence.
  for metric in select * from (values
    ('goal_success', 'successSignalId', 'goal_success'),
    ('scope_violation', 'safetySignalId', 'scope_violation'),
    ('latency_ms', 'latencySignalId', 'latencyMs'),
    ('cost_usd', 'costSignalId', 'costUsd')
  ) as m(metric_key, id_key, value_key) loop
    select s.metric_value into signal_value from public.agent_runtime_outcome_signals s
     where s.tenant_id = p_tenant_id and s.execution_id = p_result ->> 'rerunExecutionId'
       and s.signal_id = p_result -> 'signalIds' ->> metric.id_key
       and s.metric_key = metric.metric_key and s.source in ('runtime', 'deterministic_evaluator');
    if not found then
      raise exception 'canary measurement does not match persisted outcome evidence' using errcode = 'P0001';
    end if;
    if metric.metric_key = 'goal_success' then success_value := signal_value; end if;
    if metric.metric_key = 'scope_violation' then safety_value := signal_value; end if;
    if metric.metric_key in ('latency_ms', 'cost_usd') and signal_value is distinct from
      (p_result ->> metric.value_key)::double precision then
      raise exception 'canary latency or cost contradicts persisted outcome' using errcode = 'P0001';
    end if;
  end loop;
  if success_value not in (0, 1) or safety_value < 0 or safety_value <> trunc(safety_value)
     or (p_result ->> 'failureRate')::double precision is distinct from 1 - success_value
     or (p_result ->> 'safetyViolations')::double precision is distinct from safety_value
     or p_result ->> 'integrityValid' is distinct from
       (case when safety_value = 0 and p_completed_at <= source.occurred_at +
         ((source.payload ->> 'maxDurationMs')::bigint * interval '1 millisecond') then 'true' else 'false' end)
     or p_result ->> 'windowComplete' <> 'true' then
    raise exception 'canary derived measurements contradict persisted runtime outcomes' using errcode = '23514';
  end if;
  breach := p_completed_at > source.occurred_at +
    ((source.payload ->> 'maxDurationMs')::bigint * interval '1 millisecond')
    or p_result ->> 'integrityValid' <> 'true'
    or (p_result ->> 'failureRate')::double precision > (source.payload -> 'thresholds' ->> 'maxFailureRate')::double precision
    or (p_result ->> 'safetyViolations')::integer > (source.payload -> 'thresholds' ->> 'maxSafetyViolations')::integer
    or (p_result ->> 'latencyMs')::double precision > (source.payload -> 'thresholds' ->> 'maxLatencyMs')::double precision
    or (p_result ->> 'costUsd')::double precision > (source.payload -> 'thresholds' ->> 'maxCostUsd')::double precision;
  if (breach and p_result ->> 'state' <> 'rolled_back')
     or (not breach and (p_result ->> 'state' <> 'promotion_eligible'
       or p_result ->> 'windowComplete' <> 'true')) then
    raise exception 'canary outcome contradicts frozen thresholds' using errcode = '23514';
  end if;
  insert into public.agent_runtime_lifecycle_records (
    record_id, tenant_id, product_key, record_kind, source_execution_id,
    parent_record_id, source_digest, payload, occurred_at
  ) values (
    p_event_id, p_tenant_id, p_product_key, 'canary_monitor', source.source_execution_id,
    p_canary_id, p_source_digest, p_result, p_completed_at
  );
  insert into public.agent_runtime_control_plane_records (
    record_id, tenant_id, product_key, record_kind, schema_version,
    source_record_id, source_digest, payload, occurred_at
  ) values (
    'control:' || p_event_id, p_tenant_id, p_product_key, 'canary',
    'control-plane-snapshot-v1', p_event_id, p_source_digest, p_projection, p_completed_at
  );
  insert into public.agent_runtime_deployments (
    deployment_id, tenant_id, product_key, environment, manifest, risk_level,
    status, supersedes_deployment_id, created_at
  ) values (
    p_event_id, p_tenant_id, p_product_key, deployment.environment,
    deployment.manifest, deployment.risk_level,
    case when breach then 'rolled_back' else 'candidate' end,
    deployment.deployment_id, p_completed_at
  );
  return query select p_event_id, (p_result ->> 'state');
end;
$$;
revoke all on function public.agent_runtime_finish_nonproduction_canary(text,text,text,text,jsonb,text,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.agent_runtime_finish_nonproduction_canary(text,text,text,text,jsonb,text,jsonb,timestamptz) to service_role;
