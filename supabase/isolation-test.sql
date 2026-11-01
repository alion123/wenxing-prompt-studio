begin;
insert into auth.users(id,aud,role) values('ff830ee0-3540-42a4-8fb1-71da12c74537','authenticated','authenticated'),('83b90cbb-c55f-4c91-9df6-a6a4458b6a08','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','ff830ee0-3540-42a4-8fb1-71da12c74537',true);
do $$ begin
 if public.wenxing_save_workspace('{"projects":[],"active":""}',0)<>1 then raise exception 'first-save failed';end if;
 if public.wenxing_save_workspace('{"projects":[],"active":""}',1)<>2 then raise exception 'update failed';end if;
 begin perform public.wenxing_save_workspace('{"projects":[],"active":""}',1);raise exception 'stale write accepted';exception when serialization_failure then null;end;
end $$;
select set_config('request.jwt.claim.sub','83b90cbb-c55f-4c91-9df6-a6a4458b6a08',true);
do $$ begin
 if exists(select 1 from public.wenxing_workspaces) then raise exception 'cross-user read';end if;
 begin insert into public.wenxing_workspaces(user_id,workspace) values('ff830ee0-3540-42a4-8fb1-71da12c74537','{}');raise exception 'cross-user write accepted';exception when insufficient_privilege then null;end;
 if public.wenxing_save_workspace('{"projects":[],"active":""}',0)<>1 then raise exception 'second-user save failed';end if;
 if (select count(*) from public.wenxing_workspaces)<>1 then raise exception 'isolation failed';end if;
end $$;
rollback;
select 'PASS: owner read/write, cross-user isolation, stale-save conflict; all fixtures rolled back' as verification;
