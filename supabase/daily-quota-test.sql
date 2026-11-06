-- Administrator-only smoke test. All users/counter changes roll back; no mail/model calls.
begin;
do $test$
declare
 owner_id uuid:='a0000000-0000-4000-8000-000000000007'; result jsonb;
 today date:=(now() at time zone 'Asia/Shanghai')::date; global_before integer;
begin
 if exists(select 1 from auth.users where id=owner_id) then raise exception 'Synthetic test id already exists'; end if;
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
 values(owner_id,'authenticated','authenticated','daily-quota@example.test',now(),now(),now());
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.wenxing_generation_budget(day,actor) values(today,'global'),(today,owner_id::text) on conflict do nothing;
 -- The shared row is locked until rollback; its original value is restored.
 update public.wenxing_generation_budget set used=0,last_request=null where day=today and actor='global';
 result:=public.wenxing_consume_generation();
 if result->>'allowed'<>'true' or (result->>'remaining')::int<>6 or (result->>'limit')::int<>7 then raise exception 'First allowance is not seven'; end if;
 if (result->>'reset_at')::timestamptz<>((today+1)::timestamp at time zone 'Asia/Shanghai') then raise exception 'Reset is not Beijing midnight'; end if;
 result:=public.wenxing_consume_generation();
 if result->>'reason'<>'interval' then raise exception 'Request interval bypass'; end if;
 update public.wenxing_generation_budget set used=3,last_request=now()-interval '1 minute' where day=today and actor=owner_id::text;
 result:=public.wenxing_consume_generation();
 if result->>'allowed'<>'true' or (result->>'remaining')::int<>3 then raise exception 'Fourth request must leave three'; end if;
 update public.wenxing_generation_budget set used=6,last_request=now()-interval '1 minute' where day=today and actor=owner_id::text;
 result:=public.wenxing_consume_generation();
 if result->>'allowed'<>'true' or (result->>'remaining')::int<>0 then raise exception 'Seventh request must succeed and leave zero'; end if;
 select used into global_before from public.wenxing_generation_budget where day=today and actor='global';
 result:=public.wenxing_consume_generation();
 if result->>'allowed'<>'false' or result->>'reason'<>'account_daily' or (result->>'remaining')::int<>0 then raise exception 'Eighth request was not denied'; end if;
 if (select used from public.wenxing_generation_budget where day=today and actor='global')<>global_before then raise exception 'Denied request consumed quota'; end if;
 update public.wenxing_generation_budget set used=20 where day=today and actor=owner_id::text;
 result:=public.wenxing_consume_generation();
 if result->>'reason'<>'account_daily' or (result->>'remaining')::int<>0 then raise exception 'Legacy usage produced invalid allowance'; end if;
 update public.wenxing_generation_budget set used=0,last_request=null where day=today and actor=owner_id::text;
 update public.wenxing_generation_budget set used=200 where day=today and actor='global';
 result:=public.wenxing_consume_generation();
 if result->>'reason'<>'site_daily' then raise exception 'Shared site quota bypass'; end if;
 if has_function_privilege('anon','public.wenxing_consume_generation()','EXECUTE') then raise exception 'Anonymous RPC access'; end if;
 if has_table_privilege('authenticated','public.wenxing_generation_budget','UPDATE') then raise exception 'Direct quota write access'; end if;
end;
$test$;
rollback;
select 'daily_seven_quota_checks_passed_and_rolled_back' as result;
