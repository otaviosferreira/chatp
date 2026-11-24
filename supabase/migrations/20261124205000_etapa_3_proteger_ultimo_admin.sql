-- Protege a integridade do último administrador ativo mesmo em atualizações concorrentes.
create or replace function private.prevent_last_active_it_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_admin_count integer;
begin
  if old.role = 'it_admin'
     and old.status = 'active'
     and (new.role <> 'it_admin' or new.status <> 'active') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('chatapp:last-active-it-admin', 0)
    );

    select count(*)::integer
      into active_admin_count
      from public.profiles
      where role = 'it_admin'
        and status = 'active';

    if active_admin_count <= 1 then
      raise exception 'LAST_ACTIVE_IT_ADMIN: não é permitido remover o último administrador ativo.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_last_active_it_admin_removal() from public, anon, authenticated;

drop trigger if exists profiles_protect_last_active_it_admin on public.profiles;
create trigger profiles_protect_last_active_it_admin
before update of role, status on public.profiles
for each row
execute function private.prevent_last_active_it_admin_removal();
