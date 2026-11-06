begin;
do $test$
declare uid uuid:='a0000000-0000-4000-8000-000000000008';d jsonb;before_count integer;
begin
 if exists(select 1 from auth.users where id=uid) then raise exception 'Test id exists';end if;
 select count(*) into before_count from public.wenxing_generation_budget;
 insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
 values(uid,'authenticated','authenticated','admin-test@example.test',now(),now(),now(),'{}','{"wenxing_admin":true}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 d:=public.wenxing_quota_status();
 if (d->>'remaining')::int is distinct from 7 or (d->>'limit')::int is distinct from 7 then raise exception 'Quota read failed';end if;
 if (select count(*) from public.wenxing_generation_budget)<>before_count then raise exception 'Read consumed quota';end if;
 begin perform public.wenxing_admin_dashboard();raise exception 'Nonadmin accepted';exception when insufficient_privilege then null;end;
 update auth.users set raw_app_meta_data='{"wenxing_admin":true}' where id=uid;
 d:=public.wenxing_admin_dashboard(0,'admin-test@example.test');
 if (d->>'total')::int is distinct from 1 or jsonb_array_length(d->'users')<>1 or jsonb_array_length(d->'days')<>30 then raise exception 'Admin page invalid';end if;
 if d->'users'->0 ? 'raw_app_meta_data' or d->'users'->0 ? 'encrypted_password' then raise exception 'Sensitive fields leaked';end if;
 if jsonb_array_length(public.wenxing_admin_dashboard(20,'admin-test@example.test')->'users')<>0 then raise exception 'Pagination failed';end if;
 update auth.users set email_confirmed_at=null where id=uid;
 begin perform public.wenxing_admin_dashboard();raise exception 'Unverified admin accepted';exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.wenxing_admin_dashboard(integer,text)','execute') or has_function_privilege('anon','public.wenxing_quota_status()','execute') then raise exception 'Anonymous access';end if;
end; $test$;
rollback;
select 'admin_and_quota_checks_passed_rolled_back' as result,
 (select count(*) from auth.users where email_confirmed_at is not null and raw_app_meta_data->'wenxing_admin'='true'::jsonb) as existing_verified_admins;
