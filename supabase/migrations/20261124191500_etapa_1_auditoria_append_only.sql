-- Complemento da Etapa 1: auditoria append-only e sequência sem acesso de cliente.
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated;

create or replace function private.reject_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE: registros de auditoria são append-only.'
    using errcode = '55000';
end;
$$;

create trigger audit_logs_no_update
before update on public.audit_logs
for each row execute function private.reject_audit_log_mutation();
