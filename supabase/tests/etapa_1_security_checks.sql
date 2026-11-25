-- ChatP: verificações estruturais e de privilégios da Etapa 1.
-- Somente leitura: não cria usuários, não insere dados e não altera o schema.
do $$
declare
  required_tables text[] := array[
    'profiles','conversations','conversation_members','messages',
    'attachments','audit_logs','access_requests'
  ];
  t text;
  missing_count integer;
begin
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ) then raise exception 'FAIL: existe tabela em public sem RLS'; end if;

  select count(*) into missing_count
  from unnest(required_tables) as expected(name)
  where not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = expected.name and c.relkind = 'r'
  );
  if missing_count <> 0 then
    raise exception 'FAIL: faltam % tabelas esperadas do modelo', missing_count;
  end if;

  foreach t in array required_tables loop
    if pg_catalog.has_table_privilege('anon', format('public.%I', t),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'FAIL: anon possui privilégio direto em public.%', t;
    end if;
  end loop;

  if pg_catalog.has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated','public.conversations','INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated','public.conversation_members','INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated','public.audit_logs','INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated','public.messages','UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('authenticated','public.attachments','UPDATE,DELETE,TRUNCATE') then
    raise exception 'FAIL: authenticated possui escrita não prevista em tabela protegida';
  end if;

  if not pg_catalog.has_table_privilege('authenticated','public.messages','INSERT')
     or not pg_catalog.has_table_privilege('authenticated','public.attachments','INSERT')
     or not pg_catalog.has_table_privilege('authenticated','public.access_requests','INSERT')
     or not pg_catalog.has_table_privilege('authenticated','public.access_requests','UPDATE') then
    raise exception 'FAIL: faltam privilégios mínimos previstos para authenticated';
  end if;

  if pg_catalog.has_schema_privilege('anon','private','USAGE') then
    raise exception 'FAIL: anon possui USAGE no schema private';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)
  ) then raise exception 'FAIL: função SECURITY DEFINER em private sem search_path vazio'; end if;

  if not exists (select 1 from pg_catalog.pg_trigger where tgname='profiles_no_hard_delete' and tgenabled <> 'D')
     or not exists (select 1 from pg_catalog.pg_trigger where tgname='messages_no_hard_delete' and tgenabled <> 'D')
     or not exists (select 1 from pg_catalog.pg_trigger where tgname='audit_logs_no_hard_delete' and tgenabled <> 'D')
     or not exists (select 1 from pg_catalog.pg_trigger where tgname='audit_logs_no_update' and tgenabled <> 'D')
     or not exists (select 1 from pg_catalog.pg_trigger where tgname='profiles_protect_last_active_it_admin' and tgenabled <> 'D') then
    raise exception 'FAIL: trigger crítico ausente ou desabilitado';
  end if;

  if exists (select 1 from storage.buckets where public is true) then
    raise exception 'FAIL: existe bucket público no Storage';
  end if;

  raise notice 'PASS: verificações estruturais e de privilégios da Etapa 1 concluídas.';
end $$;