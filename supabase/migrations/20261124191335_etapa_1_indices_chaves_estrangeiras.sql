-- Complemento da Etapa 1: índices para FKs identificadas pelo Performance Advisor.
create index if not exists conversation_members_added_by_idx on public.conversation_members(added_by);
create index if not exists attachments_message_id_idx on public.attachments(message_id);
create index if not exists attachments_uploaded_by_idx on public.attachments(uploaded_by);
create index if not exists access_requests_requester_id_idx on public.access_requests(requester_id);
create index if not exists access_requests_opened_by_idx on public.access_requests(opened_by);
