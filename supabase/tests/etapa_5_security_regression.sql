-- ChatP Etapa 5: regressão de segurança do banco.
-- Usa uma identidade fictícia em transação e reverte todos os dados no final.
begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-4000-8000-000000000051','authenticated','authenticated','stage5-admin-test@ulife.com.br','test-only-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
insert into public.profiles (id,full_name,email,department,role,status)
values ('00000000-0000-4000-8000-000000000051','Teste SQA Admin','stage5-admin-test@ulife.com.br','QA','it_admin','active');

-- A remoção de um administrador é permitida enquanto ainda existe outro administrador ativo.
update public.profiles set status='disabled'
where id='00000000-0000-4000-8000-000000000051';

do $sqa$
declare
  audit_id bigint;
begin
  -- O único administrador real não pode ser desativado/rebaixado.
  begin
    update public.profiles set status='disabled'
    where id='ceaed021-6134-4bfb-8f1f-204649d867ca';
    raise exception 'FAIL: o banco permitiu desativar o último administrador';
  exception when check_violation then
    null;
  end;

  select id into audit_id from public.audit_logs order by id limit 1;
  if audit_id is not null then
    begin
      update public.audit_logs set reason=reason where id=audit_id;
      raise exception 'FAIL: o banco permitiu alterar auditoria';
    exception when sqlstate '55000' then
      null;
    end;
    begin
      delete from public.audit_logs where id=audit_id;
      raise exception 'FAIL: o banco permitiu excluir auditoria';
    exception when sqlstate '55000' then
      null;
    end;
  end if;
end
$sqa$;

rollback;

-- Verificações sem dados de teste.
do $catalog$
declare
  fn text;
begin
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
  ) then raise exception 'FAIL: tabela pública sem RLS'; end if;

  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and pg_catalog.has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
  ) then raise exception 'FAIL: anon possui privilégio direto em tabela pública'; end if;

  if pg_catalog.has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.conversations','INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.conversation_members','INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.audit_logs','INSERT,UPDATE,DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.message_receipts','INSERT,UPDATE,DELETE') then
    raise exception 'FAIL: cliente autenticado possui escrita direta em tabela protegida';
  end if;

  if pg_catalog.has_schema_privilege('anon','private','USAGE') then
    raise exception 'FAIL: anon tem acesso ao schema private';
  end if;

  foreach fn in array array[
    'public.create_direct_conversation(uuid)',
    'public.create_group_conversation(text,uuid[])',
    'public.add_conversation_member(uuid,uuid)',
    'public.remove_conversation_member(uuid,uuid)',
    'public.leave_conversation(uuid)',
    'public.mark_conversation_delivered(uuid)',
    'public.mark_conversation_read(uuid)'
  ] loop
    if pg_catalog.has_function_privilege('anon',fn,'EXECUTE') then raise exception 'FAIL: anon executa %',fn; end if;
    if not exists (select 1 from pg_catalog.pg_proc p where p.oid=fn::regprocedure and p.prosecdef and coalesce(p.proconfig @> array['search_path=""'],false)) then
      raise exception 'FAIL: configuração insegura em %',fn;
    end if;
  end loop;

  if exists (select 1 from storage.buckets where public is true) then
    raise exception 'FAIL: existe bucket público';
  end if;

  if exists (select 1 from auth.users where email in ('stage5-admin-test@ulife.com.br','stage4-user1@ulife.com.br','stage4-user2@ulife.com.br','stage4-user3@ulife.com.br')) then
    raise exception 'FAIL: usuário fictício de teste permaneceu no banco';
  end if;

  raise notice 'PASS: regressão SQA de segurança concluída.';
end
$catalog$;
