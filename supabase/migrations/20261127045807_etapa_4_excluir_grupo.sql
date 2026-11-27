-- ChatP: exclusão lógica e segura de grupos pelo criador.
-- Mantém mensagens e recibos para preservar histórico/auditoria.
create or replace function public.delete_group_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_kind text;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;

  select c.created_by, c.kind
    into v_created_by, v_kind
  from public.conversations c
  where c.id = p_conversation_id
    and c.archived_at is null
  for update;

  if not found or v_kind <> 'group' or v_created_by <> v_user_id then
    raise exception 'GROUP_OWNER_REQUIRED' using errcode = '42501';
  end if;

  update public.conversations
  set archived_at = pg_catalog.now()
  where id = p_conversation_id;

  update public.conversation_members
  set left_at = coalesce(left_at, pg_catalog.now())
  where conversation_id = p_conversation_id;
end;
$$;

revoke all on function public.delete_group_conversation(uuid) from public, anon;
grant execute on function public.delete_group_conversation(uuid) to authenticated;

comment on function public.delete_group_conversation(uuid) is
  'Arquiva logicamente um grupo somente pelo criador, preservando mensagens e recibos.';
