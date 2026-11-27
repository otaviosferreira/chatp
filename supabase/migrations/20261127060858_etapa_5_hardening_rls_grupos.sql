-- Etapa 5 — hardening de privacidade e integridade de grupos.
-- Administradores de TI continuam vendo metadados/auditoria autorizados,
-- mas não recebem acesso transversal ao conteúdo de mensagens ou anexos.
drop policy if exists messages_read_scope on public.messages;
create policy messages_read_scope
on public.messages
for select
to authenticated
using ((select private.is_conversation_member(conversation_id)));

drop policy if exists attachments_read_scope on public.attachments;
create policy attachments_read_scope
on public.attachments
for select
to authenticated
using ((select private.is_conversation_member(conversation_id)));

-- Serializa inclusões por grupo e preserva o limite total de 50 participantes.
create or replace function public.add_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_kind text;
  v_active_members integer;
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

  if p_user_id is null or p_user_id = v_user_id
     or not exists (
       select 1 from public.profiles p
       where p.id = p_user_id and p.status = 'active'
     ) then
    raise exception 'INVALID_GROUP_MEMBER' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
      and cm.left_at is null
  ) then
    raise exception 'ALREADY_GROUP_MEMBER' using errcode = '23505';
  end if;

  select count(*)::integer
    into v_active_members
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.left_at is null;

  if v_active_members >= 50 then
    raise exception 'GROUP_MEMBER_LIMIT_REACHED' using errcode = '54000';
  end if;

  insert into public.conversation_members(conversation_id, user_id, added_by)
  values (p_conversation_id, p_user_id, v_user_id)
  on conflict (conversation_id, user_id)
  do update set
    added_by = excluded.added_by,
    joined_at = pg_catalog.now(),
    left_at = null;
end;
$function$;

revoke all on function public.add_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.add_conversation_member(uuid, uuid) to authenticated;

comment on policy messages_read_scope on public.messages is
  'Somente participantes ativos podem ler conteúdo de mensagens; TI consulta eventos de auditoria separados.';
comment on policy attachments_read_scope on public.attachments is
  'Somente participantes ativos podem ler metadados de anexos; não concede acesso ao Storage.';
comment on function public.add_conversation_member(uuid, uuid) is
  'Somente criador ativo adiciona membros; bloqueia o 51º participante e serializa inclusões por grupo.';
