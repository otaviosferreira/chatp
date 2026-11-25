-- ChatP Etapa 4: conversas, participantes, recibos e RPCs seguros.
-- Escritas em conversas/participantes ficam encapsuladas em funções validadas no banco.

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id),
  constraint message_receipts_read_requires_delivery
    check (read_at is null or delivered_at is not null)
);

create index if not exists message_receipts_user_message_idx
  on public.message_receipts(user_id, message_id);
create index if not exists messages_search_idx
  on public.messages using gin (to_tsvector('portuguese', body));

alter table public.message_receipts enable row level security;
revoke all on public.message_receipts from anon, authenticated;
grant select on public.message_receipts to authenticated;

create policy message_receipts_read_scope
on public.message_receipts for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.messages m
    where m.id = message_receipts.message_id
      and m.sender_id = (select auth.uid())
  )
);

create or replace function private.create_message_receipts()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.message_receipts(message_id, user_id)
  select new.id, cm.user_id
  from public.conversation_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.conversation_id = new.conversation_id
    and cm.left_at is null and p.status = 'active'
    and cm.user_id <> new.sender_id
  on conflict (message_id, user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_message_receipts() from public, anon, authenticated;
drop trigger if exists messages_create_receipts on public.messages;
create trigger messages_create_receipts after insert on public.messages
for each row execute function private.create_message_receipts();

create or replace function public.create_direct_conversation(p_other_user_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'INVALID_DIRECT_PARTICIPANT' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_other_user_id and p.status='active') then
    raise exception 'TARGET_EMPLOYEE_NOT_ACTIVE' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'chatp:direct:' || least(v_user_id::text,p_other_user_id::text) || ':' ||
    greatest(v_user_id::text,p_other_user_id::text), 0
  ));

  select c.id into v_conversation_id
  from public.conversations c
  where c.kind='direct' and c.archived_at is null
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=v_user_id and cm.left_at is null)
    and exists (select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_other_user_id and cm.left_at is null)
    and (select count(*) from public.conversation_members cm where cm.conversation_id=c.id and cm.left_at is null)=2
  limit 1;
  if v_conversation_id is not null then return v_conversation_id; end if;

  insert into public.conversations(kind,created_by) values ('direct',v_user_id)
  returning id into v_conversation_id;
  insert into public.conversation_members(conversation_id,user_id,added_by)
  values (v_conversation_id,v_user_id,v_user_id),(v_conversation_id,p_other_user_id,v_user_id);
  return v_conversation_id;
end;
$$;

create or replace function public.create_group_conversation(p_title text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_ids uuid[];
  v_conversation_id uuid;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;
  if p_title is null or pg_catalog.length(pg_catalog.btrim(p_title))<1
     or pg_catalog.length(pg_catalog.btrim(p_title))>120 then
    raise exception 'INVALID_GROUP_TITLE' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.array_agg(distinct ids.member_id),array[]::uuid[])
  into v_member_ids
  from pg_catalog.unnest(coalesce(p_member_ids,array[]::uuid[])) as ids(member_id)
  where ids.member_id is not null and ids.member_id<>v_user_id;

  if pg_catalog.cardinality(v_member_ids)<1 or pg_catalog.cardinality(v_member_ids)>49 then
    raise exception 'GROUP_REQUIRES_1_TO_49_OTHER_MEMBERS' using errcode = '22023';
  end if;
  if exists (
    select 1 from pg_catalog.unnest(v_member_ids) as ids(member_id)
    where not exists (select 1 from public.profiles p where p.id=ids.member_id and p.status='active')
  ) then raise exception 'GROUP_CONTAINS_INACTIVE_OR_UNKNOWN_MEMBER' using errcode = '42501'; end if;

  insert into public.conversations(kind,title,created_by)
  values ('group',pg_catalog.btrim(p_title),v_user_id) returning id into v_conversation_id;
  insert into public.conversation_members(conversation_id,user_id,added_by)
  values (v_conversation_id,v_user_id,v_user_id);
  insert into public.conversation_members(conversation_id,user_id,added_by)
  select v_conversation_id,ids.member_id,v_user_id
  from pg_catalog.unnest(v_member_ids) as ids(member_id);
  return v_conversation_id;
end;
$$;

create or replace function public.add_conversation_member(p_conversation_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_kind text;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;
  select c.created_by,c.kind into v_created_by,v_kind
  from public.conversations c where c.id=p_conversation_id and c.archived_at is null;
  if not found or v_kind<>'group' or v_created_by<>v_user_id then
    raise exception 'GROUP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id=v_user_id or not exists (
    select 1 from public.profiles p where p.id=p_user_id and p.status='active'
  ) then raise exception 'INVALID_GROUP_MEMBER' using errcode = '22023'; end if;
  if exists (select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_user_id and cm.left_at is null) then
    raise exception 'ALREADY_GROUP_MEMBER' using errcode = '23505';
  end if;
  insert into public.conversation_members(conversation_id,user_id,added_by)
  values (p_conversation_id,p_user_id,v_user_id)
  on conflict (conversation_id,user_id)
  do update set added_by=excluded.added_by,joined_at=pg_catalog.now(),left_at=null;
end;
$$;

create or replace function public.remove_conversation_member(p_conversation_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_kind text;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;
  select c.created_by,c.kind into v_created_by,v_kind
  from public.conversations c where c.id=p_conversation_id and c.archived_at is null;
  if not found or v_kind<>'group' or v_created_by<>v_user_id then
    raise exception 'GROUP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id=v_created_by then raise exception 'GROUP_OWNER_CANNOT_REMOVE_SELF' using errcode = '42501'; end if;
  update public.conversation_members set left_at=pg_catalog.now()
  where conversation_id=p_conversation_id and user_id=p_user_id and left_at is null;
  if not found then raise exception 'ACTIVE_GROUP_MEMBER_NOT_FOUND' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.leave_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_created_by uuid;
  v_kind text;
  v_next_owner uuid;
begin
  if v_user_id is null or not private.is_active_employee() then
    raise exception 'ACTIVE_EMPLOYEE_REQUIRED' using errcode = '42501';
  end if;
  select c.created_by,c.kind into v_created_by,v_kind
  from public.conversations c where c.id=p_conversation_id and c.archived_at is null;
  if not found or not private.is_conversation_member(p_conversation_id) then
    raise exception 'CONVERSATION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if v_kind='group' and v_created_by=v_user_id then
    select cm.user_id into v_next_owner from public.conversation_members cm
    where cm.conversation_id=p_conversation_id and cm.user_id<>v_user_id and cm.left_at is null
    order by cm.joined_at asc limit 1;
    update public.conversations
    set created_by=coalesce(v_next_owner,v_created_by),
        archived_at=case when v_next_owner is null then pg_catalog.now() else archived_at end
    where id=p_conversation_id;
  end if;
  update public.conversation_members set left_at=pg_catalog.now()
  where conversation_id=p_conversation_id and user_id=v_user_id and left_at is null;
end;
$$;

create or replace function public.mark_conversation_delivered(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null or not private.is_active_employee() or not private.is_conversation_member(p_conversation_id) then
    raise exception 'CONVERSATION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  update public.message_receipts mr
  set delivered_at=coalesce(mr.delivered_at,pg_catalog.now())
  from public.messages m
  where mr.message_id=m.id and m.conversation_id=p_conversation_id
    and mr.user_id=v_user_id and mr.delivered_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null or not private.is_active_employee() or not private.is_conversation_member(p_conversation_id) then
    raise exception 'CONVERSATION_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  update public.message_receipts mr
  set delivered_at=coalesce(mr.delivered_at,pg_catalog.now()),
      read_at=coalesce(mr.read_at,pg_catalog.now())
  from public.messages m
  where mr.message_id=m.id and m.conversation_id=p_conversation_id
    and mr.user_id=v_user_id and mr.read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public,anon;
revoke all on function public.create_group_conversation(text,uuid[]) from public,anon;
revoke all on function public.add_conversation_member(uuid,uuid) from public,anon;
revoke all on function public.remove_conversation_member(uuid,uuid) from public,anon;
revoke all on function public.leave_conversation(uuid) from public,anon;
revoke all on function public.mark_conversation_delivered(uuid) from public,anon;
revoke all on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_group_conversation(text,uuid[]) to authenticated;
grant execute on function public.add_conversation_member(uuid,uuid) to authenticated;
grant execute on function public.remove_conversation_member(uuid,uuid) to authenticated;
grant execute on function public.leave_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_delivered(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_receipts') then
    execute 'alter publication supabase_realtime add table public.message_receipts';
  end if;
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
    execute 'alter publication supabase_realtime add table public.conversations';
  end if;
  if not exists (select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_members') then
    execute 'alter publication supabase_realtime add table public.conversation_members';
  end if;
end $$;

comment on table public.message_receipts is
  'Recibos por destinatário; escrita somente por funções controladas no banco.';
