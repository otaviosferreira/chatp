-- ChatP Etapa 4: testes de integração transacionais com identidades fictícias.
-- Todos os registros são revertidos por ROLLBACK; nenhum usuário de teste permanece no projeto.
begin;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000041','authenticated','authenticated','stage4-user1@ulife.com.br','test-only-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('00000000-0000-4000-8000-000000000042','authenticated','authenticated','stage4-user2@ulife.com.br','test-only-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
 ('00000000-0000-4000-8000-000000000043','authenticated','authenticated','stage4-user3@ulife.com.br','test-only-no-login',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
insert into public.profiles (id,full_name,email,department,role,status)
values
 ('00000000-0000-4000-8000-000000000041','Teste ChatP Um','stage4-user1@ulife.com.br','QA','employee','active'),
 ('00000000-0000-4000-8000-000000000042','Teste ChatP Dois','stage4-user2@ulife.com.br','QA','employee','active'),
 ('00000000-0000-4000-8000-000000000043','Teste ChatP Três','stage4-user3@ulife.com.br','QA','employee','active');
set local role authenticated;
do $$
declare
  u1 uuid := '00000000-0000-4000-8000-000000000041';
  u2 uuid := '00000000-0000-4000-8000-000000000042';
  u3 uuid := '00000000-0000-4000-8000-000000000043';
  direct_id uuid;
  direct_id_again uuid;
  group_id uuid;
  v_count integer;
  v_owner uuid;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',u1::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u1::text,'role','authenticated')::text,true);
  direct_id := public.create_direct_conversation(u2);
  direct_id_again := public.create_direct_conversation(u2);
  if direct_id<>direct_id_again then raise exception 'FAIL: direct conversation is not idempotent'; end if;
  insert into public.messages(conversation_id,sender_id,body) values(direct_id,u1,'Mensagem de teste da Etapa 4');
  select count(*) into v_count from public.message_receipts
  where message_id=(select id from public.messages where conversation_id=direct_id) and user_id=u2;
  if v_count<>1 then raise exception 'FAIL: receipt was not created for recipient'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',u2::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u2::text,'role','authenticated')::text,true);
  perform public.mark_conversation_delivered(direct_id);
  perform public.mark_conversation_read(direct_id);

  perform pg_catalog.set_config('request.jwt.claim.sub',u1::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u1::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.message_receipts mr
  join public.messages m on m.id=mr.message_id
  where m.conversation_id=direct_id and mr.user_id=u2 and mr.delivered_at is not null and mr.read_at is not null;
  if v_count<>1 then raise exception 'FAIL: delivered/read receipt not visible to sender'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',u3::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u3::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.messages where conversation_id=direct_id;
  if v_count<>0 then raise exception 'FAIL: non-member can read direct messages'; end if;
  begin
    perform public.mark_conversation_read(direct_id);
    raise exception 'FAIL: non-member marked conversation read';
  exception when insufficient_privilege then null;
  end;

  perform pg_catalog.set_config('request.jwt.claim.sub',u1::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u1::text,'role','authenticated')::text,true);
  group_id := public.create_group_conversation('Grupo de teste',array[u2]::uuid[]);
  perform public.add_conversation_member(group_id,u3);
  perform pg_catalog.set_config('request.jwt.claim.sub',u2::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u2::text,'role','authenticated')::text,true);
  begin
    perform public.remove_conversation_member(group_id,u3);
    raise exception 'FAIL: non-owner removed a group member';
  exception when insufficient_privilege then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub',u1::text,true);
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.json_build_object('sub',u1::text,'role','authenticated')::text,true);
  perform public.remove_conversation_member(group_id,u3);
  perform public.leave_conversation(group_id);
  select created_by into v_owner from public.conversations where id=group_id;
  if v_owner<>u2 then raise exception 'FAIL: group ownership was not transferred on owner exit'; end if;
  raise notice 'PASS: direct, group, RLS isolation, read receipts and membership controls passed.';
end $$;
rollback;
