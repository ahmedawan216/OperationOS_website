-- Existing founder rollback RPC and measured canary monitoring must agree on
-- exactly one terminal event for an immutable non-production canary.
create or replace function agent_runtime_private.guard_canary_terminal_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare parent public.agent_runtime_deployments%rowtype;
begin
  if new.supersedes_deployment_id is null or new.status not in ('rolled_back', 'candidate') then
    return new;
  end if;
  select * into parent from public.agent_runtime_deployments
   where deployment_id = new.supersedes_deployment_id for update;
  if not found or parent.status <> 'canary' then return new; end if;
  if parent.tenant_id <> new.tenant_id or parent.product_key <> new.product_key
     or parent.environment <> new.environment or new.environment = 'production' then
    raise exception 'canary terminal event crosses its frozen scope' using errcode = '23514';
  end if;
  if exists (select 1 from public.agent_runtime_deployments terminal
      where terminal.supersedes_deployment_id = parent.deployment_id
        and terminal.status in ('rolled_back', 'candidate')) then
    raise exception 'canary already has a terminal event' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger agent_runtime_canary_terminal_guard
  before insert on public.agent_runtime_deployments
  for each row execute function agent_runtime_private.guard_canary_terminal_insert();
revoke all on function agent_runtime_private.guard_canary_terminal_insert() from public, anon, authenticated;
