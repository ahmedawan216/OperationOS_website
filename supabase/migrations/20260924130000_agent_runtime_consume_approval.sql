-- Consumption is separate from founder resolution and is atomic, scoped and
-- single-use. The existing immutable identity/transition trigger still applies.
create unique index if not exists agent_runtime_one_canary_approval_per_action
  on public.agent_runtime_approval_requests (tenant_id, product_key, candidate_id, action_digest)
  where action_type = 'start_canary' and candidate_id is not null;

create or replace function public.agent_runtime_consume_approval(
  p_tenant_id text, p_product_key text, p_execution_id text,
  p_candidate_id text, p_approval_id text, p_actor_id text,
  p_action_digest text, p_consumed_at timestamptz
)
returns table (approval_id text, status text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  update public.agent_runtime_approval_requests as approval
     set status = 'consumed', consumed_at = p_consumed_at
   where approval.tenant_id = p_tenant_id
     and approval.product_key = p_product_key
     and approval.execution_id = p_execution_id
     and approval.candidate_id = p_candidate_id
     and approval.approval_id = p_approval_id
     and approval.actor_id = p_actor_id
     and approval.resolved_by = p_actor_id
     and approval.action_type = 'start_canary'
     and approval.action_digest = p_action_digest
     and approval.status = 'approved'
     and approval.expires_at > p_consumed_at
     and approval.expires_at > now()
     and p_consumed_at between now() - interval '5 minutes' and now() + interval '5 minutes'
     and approval.resolved_at <= p_consumed_at
  returning approval.approval_id, approval.status;
  if not found then
    raise exception 'approval binding is stale, expired, or mismatched' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.agent_runtime_consume_approval(text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.agent_runtime_consume_approval(text,text,text,text,text,text,text,timestamptz) to service_role;
