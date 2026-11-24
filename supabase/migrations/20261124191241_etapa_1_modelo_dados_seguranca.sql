-- Chat corporativo Calunga — Etapa 1
-- Modelo inicial, controles estruturais e RLS. Sem dados reais ou contas de teste.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  employee_code text unique,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  email text not null unique,
  department text,
  role text not null default 'employee' check (role in ('employee', 'it_admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  title text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint group_requires_title check (kind <> 'group' or (title is not null and length(trim(title)) between 1 and 120)),
  constraint direct_has_no_title check (kind <> 'direct' or title is null)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  added_by uuid references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  bucket_id text not null default 'chat-attachments' check (bucket_id = 'chat-attachments'),
  object_path text not null unique,
  original_name text not null check (length(trim(original_name)) between 1 and 255),
  extension text not null check (lower(extension) in ('pdf', 'jpg', 'jpeg')),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg')),
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  constraint attachment_extension_mime_match check (
    (lower(extension) = 'pdf' and mime_type = 'application/pdf')
    or (lower(extension) in ('jpg', 'jpeg') and mime_type = 'image/jpeg')
  )
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null check (length(trim(action)) between 2 and 120),
  target_type text not null check (length(trim(target_type)) between 2 and 80),
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  request_type text not null check (request_type in ('formal_disclosure', 'audit_access', 'other')),
  reference_number text,
  justification text not null check (length(trim(justification)) between 10 and 4000),
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected', 'completed')),
  notified_company_at timestamptz,
  opened_by uuid references public.profiles(id) on delete restrict,
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index profiles_status_department_idx on public.profiles(status, department);
create index conversations_created_by_idx on public.conversations(created_by);
create index conversation_members_user_idx on public.conversation_members(user_id, conversation_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index messages_sender_created_idx on public.messages(sender_id, created_at desc);
create index attachments_conversation_idx on public.attachments(conversation_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
create index access_requests_status_created_idx on public.access_requests(status, created_at desc);

create or replace function private.is_active_employee()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function private.is_it_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active' and p.role = 'it_admin'
  );
$$;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.conversation_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
      and p.status = 'active'
  );
$$;

revoke all on function private.is_active_employee() from public, anon;
revoke all on function private.is_it_admin() from public, anon;
revoke all on function private.is_conversation_member(uuid) from public, anon;
grant execute on function private.is_active_employee() to authenticated;
grant execute on function private.is_it_admin() to authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create or replace function private.reject_hard_delete()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'HARD_DELETE_FORBIDDEN: registros históricos não podem ser excluídos.'
    using errcode = '55000';
end;
$$;

create trigger profiles_no_hard_delete before delete on public.profiles
for each row execute function private.reject_hard_delete();
create trigger messages_no_hard_delete before delete on public.messages
for each row execute function private.reject_hard_delete();
create trigger audit_logs_no_hard_delete before delete on public.audit_logs
for each row execute function private.reject_hard_delete();

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.access_requests enable row level security;

revoke all on public.profiles, public.conversations, public.conversation_members,
  public.messages, public.attachments, public.audit_logs, public.access_requests from anon, authenticated;
grant select on public.profiles, public.conversations, public.conversation_members,
  public.messages, public.attachments, public.audit_logs, public.access_requests to authenticated;
grant insert on public.messages, public.attachments, public.access_requests to authenticated;
grant update on public.access_requests to authenticated;
-- A sequência de auditoria não é acessível a clientes; escrita ocorre apenas no backend confiável.

create policy profiles_read_directory on public.profiles
for select to authenticated using (status = 'active' or (select private.is_it_admin()));

create policy conversations_read_members on public.conversations
for select to authenticated using ((select private.is_it_admin()) or (select private.is_conversation_member(id)));

create policy conversation_members_read_scope on public.conversation_members
for select to authenticated using ((select private.is_it_admin()) or (select private.is_conversation_member(conversation_id)));

create policy messages_read_scope on public.messages
for select to authenticated using ((select private.is_it_admin()) or (select private.is_conversation_member(conversation_id)));

create policy messages_insert_member on public.messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and (select private.is_active_employee())
  and (select private.is_conversation_member(conversation_id))
);

create policy attachments_read_scope on public.attachments
for select to authenticated using ((select private.is_it_admin()) or (select private.is_conversation_member(conversation_id)));

create policy attachments_insert_member on public.attachments
for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and (select private.is_active_employee())
  and (select private.is_conversation_member(conversation_id))
  and exists (
    select 1 from public.messages m
    where m.id = message_id and m.conversation_id = attachments.conversation_id
      and m.sender_id = (select auth.uid())
  )
);

create policy audit_logs_read_it on public.audit_logs
for select to authenticated using ((select private.is_it_admin()));

create policy access_requests_read_scope on public.access_requests
for select to authenticated using (requester_id = (select auth.uid()) or (select private.is_it_admin()));

create policy access_requests_insert_own on public.access_requests
for insert to authenticated with check (requester_id = (select auth.uid()) and (select private.is_active_employee()));

create policy access_requests_update_it on public.access_requests
for update to authenticated using ((select private.is_it_admin())) with check ((select private.is_it_admin()));

comment on table public.profiles is 'Perfis de funcionários vinculados a auth.users; desativação substitui exclusão.';
comment on table public.conversations is 'Conversas internas 1:1 ou em grupo, sem comunicados em massa.';
comment on table public.messages is 'Mensagens textuais; histórico protegido contra exclusão física.';
comment on table public.attachments is 'Metadados de anexos; somente PDF/JPEG. Assinatura real deve ser validada no servidor antes do Storage.';
comment on table public.audit_logs is 'Trilha append-only de ações administrativas e consultas de auditoria.';
comment on table public.access_requests is 'Fluxo formal de solicitação, notificação e autorização.';
