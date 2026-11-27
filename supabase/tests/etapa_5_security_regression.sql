-- ChatP Etapa 5: regressão de segurança, isolamento de conteúdo e limites de grupos.
-- Identidades fictícias @example.invalid; transação integralmente revertida.
begin;
with ids as (
 select n,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid id from generate_series(1,50) n
 union all select 51,'00000000-0000-4000-8000-000000000051'::uuid
 union all select 52,'00000000-0000-4000-8000-000000000052'::uuid
)
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',
 case when n=51 then 'stage5-admin@example.invalid' when n=52 then 'stage5-overflow@example.invalid' else 'stage5-employee-'||n||'@example.invalid' end,
 'test-only-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now() from ids;
insert into public.profiles(id,full_name,email,department,role,status)
select id,
 case when n=51 then 'Teste SQA Admin' when n=52 then 'Teste SQA Overflow' else 'Teste SQA Funcionário '||n end,
 case when n=51 then 'stage5-admin@example.invalid' when n=52 then 'stage5-overflow@example.invalid' else 'stage5-employee-'||n||'@example.invalid' end,
 'QA',case when n=51 then 'it_admin' else 'employee' end,'active'
from (
 select n,('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid id from generate_series(1,50) n
 union all select 51,'00000000-0000-4000-8000-000000000051'::uuid
 union all select 52,'00000000-0000-4000-8000-000000000052'::uuid
) p;
set local role authenticated;
do $sqa$
declare
 u1 uuid:='00000000-0000-4000-8000-000000000001'; u2 uuid:='00000000-0000-4000-8000-000000000002';
 u3 uuid:='00000000-0000-4000-8000-000000000003'; admin_id uuid:='00000000-0000-4000-8000-000000000051';
 overflow_id uuid:='00000000-0000-4000-8000-000000000052';
 direct_id uuid; full_group_id uuid; small_group_id uuid; v_message_id uuid;
 v_count integer; v_owner uuid; v_archived_at timestamptz;
begin
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u1::text,'role','authenticated')::text,true);
 direct_id:=public.create_direct_conversation(u2);
 if direct_id<>public.create_direct_conversation(u2) then raise exception 'FAIL: direct not idempotent'; end if;
 insert into public.messages(conversation_id,sender_id,body) values(direct_id,u1,'Mensagem fictícia para regressão de segurança') returning id into v_message_id;
 select count(*) into v_count from public.message_receipts mr where mr.message_id=v_message_id and mr.user_id=u2;
 if v_count<>1 then raise exception 'FAIL: recipient receipt missing'; end if;
 insert into public.attachments(message_id,conversation_id,uploaded_by,object_path,original_name,extension,mime_type,size_bytes)
 values(v_message_id,direct_id,u1,'sqa-stage5/rollback-only.pdf','teste.pdf','pdf','application/pdf',128);
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u2::text,'role','authenticated')::text,true);
 perform public.mark_conversation_delivered(direct_id); perform public.mark_conversation_read(direct_id);
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u1::text,'role','authenticated')::text,true);
 select count(*) into v_count from public.message_receipts mr where mr.message_id=v_message_id and mr.user_id=u2 and mr.delivered_at is not null and mr.read_at is not null;
 if v_count<>1 then raise exception 'FAIL: delivery/read receipt missing'; end if;
 perform set_config('request.jwt.claim.sub',u3::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u3::text,'role','authenticated')::text,true);
 select count(*) into v_count from public.messages where conversation_id=direct_id;
 if v_count<>0 then raise exception 'FAIL: non-member read messages'; end if;
 select count(*) into v_count from public.attachments where conversation_id=direct_id;
 if v_count<>0 then raise exception 'FAIL: non-member read attachments'; end if;
 begin perform public.mark_conversation_read(direct_id); raise exception 'FAIL: non-member marked read'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',admin_id::text,'role','authenticated')::text,true);
 select count(*) into v_count from public.messages where conversation_id=direct_id;
 if v_count<>0 then raise exception 'FAIL: IT admin read messages outside membership'; end if;
 select count(*) into v_count from public.attachments where conversation_id=direct_id;
 if v_count<>0 then raise exception 'FAIL: IT admin read attachment metadata outside membership'; end if;
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u1::text,'role','authenticated')::text,true);
 full_group_id:=public.create_group_conversation('Grupo no limite de 50',
  array(select p.id from public.profiles p where p.email like 'stage5-employee-%' and p.id<>u1 order by p.id));
 select count(*) into v_count from public.conversation_members where conversation_id=full_group_id and left_at is null;
 if v_count<>50 then raise exception 'FAIL: expected 50 members, got %',v_count; end if;
 begin perform public.add_conversation_member(full_group_id,overflow_id); raise exception 'FAIL: accepted 51st member'; exception when sqlstate '54000' then null; end;
 small_group_id:=public.create_group_conversation('Grupo de saída',array[u2]::uuid[]);
 perform public.add_conversation_member(small_group_id,u3);
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u2::text,'role','authenticated')::text,true);
 begin perform public.remove_conversation_member(small_group_id,u3); raise exception 'FAIL: non-owner removed member'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',u1::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u1::text,'role','authenticated')::text,true);
 perform public.remove_conversation_member(small_group_id,u3); perform public.leave_conversation(small_group_id);
 select created_by into v_owner from public.conversations where id=small_group_id;
 if v_owner<>u2 then raise exception 'FAIL: ownership not transferred'; end if;
 perform set_config('request.jwt.claim.sub',u2::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',u2::text,'role','authenticated')::text,true);
 perform public.delete_group_conversation(small_group_id);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',admin_id::text,'role','authenticated')::text,true);
 select archived_at into v_archived_at from public.conversations where id=small_group_id;
 if v_archived_at is null then raise exception 'FAIL: group not archived'; end if;
 raise notice 'PASS: RLS isolation, receipts, group ownership/deletion and 50-member cap.';
end
$sqa$;
reset role;
update public.profiles set status='disabled' where id='00000000-0000-4000-8000-000000000051';
do $integrity$
declare audit_id bigint;
begin
 begin update public.profiles set status='disabled' where id='ceaed021-6134-4bfb-8f1f-204649d867ca'; raise exception 'FAIL: last active admin disabled'; exception when check_violation then null; end;
 insert into public.audit_logs(actor_id,action,target_type,target_id,reason,metadata)
 values('00000000-0000-4000-8000-000000000051','sqa_test','security_regression','stage5','rollback-only','{}'::jsonb) returning id into audit_id;
 begin update public.audit_logs set reason=reason where id=audit_id; raise exception 'FAIL: audit update allowed'; exception when sqlstate '55000' then null; end;
 begin delete from public.audit_logs where id=audit_id; raise exception 'FAIL: audit delete allowed'; exception when sqlstate '55000' then null; end;
end
$integrity$;
rollback;
do $catalog$
declare fn text;
begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'FAIL: public table without RLS'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')) then raise exception 'FAIL: anon direct table privileges'; end if;
 if has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.conversations','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.conversation_members','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.audit_logs','INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.message_receipts','INSERT,UPDATE,DELETE') then raise exception 'FAIL: authenticated direct write on protected tables'; end if;
 if has_schema_privilege('anon','private','USAGE') then raise exception 'FAIL: anon has private schema usage'; end if;
 foreach fn in array array['public.add_conversation_member(uuid,uuid)','public.create_direct_conversation(uuid)','public.create_group_conversation(text,uuid[])','public.delete_group_conversation(uuid)','public.leave_conversation(uuid)','public.mark_conversation_delivered(uuid)','public.mark_conversation_read(uuid)','public.remove_conversation_member(uuid,uuid)'] loop
  if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'FAIL: anon executes %',fn; end if;
  if not has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'FAIL: authenticated cannot execute %',fn; end if;
  if not exists(select 1 from pg_proc p where p.oid=fn::regprocedure and p.prosecdef and coalesce(p.proconfig @> array['search_path=""'],false)) then raise exception 'FAIL: unsafe SECURITY DEFINER config for %',fn; end if;
 end loop;
 if exists(select 1 from pg_policies where schemaname='public' and tablename in ('messages','attachments') and coalesce(qual,'') ilike '%is_it_admin%') then raise exception 'FAIL: admin content bypass remains'; end if;
 if exists(select 1 from storage.buckets where public is true) then raise exception 'FAIL: public bucket exists'; end if;
 if exists(select 1 from auth.users where email like 'stage5-%@example.invalid') then raise exception 'FAIL: test users persisted'; end if;
 raise notice 'PASS: catalog, RLS, grants, eight RPCs, no admin content bypass, no public bucket, rollback.';
end
$catalog$;
