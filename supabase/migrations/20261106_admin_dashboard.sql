begin;
create or replace function public.wenxing_quota_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Shanghai')::date; used_today integer;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified account required' using errcode='42501'; end if;
 select used into used_today from public.wenxing_generation_budget where day=today and actor=auth.uid()::text;
 return jsonb_build_object('remaining',greatest(0,7-coalesce(used_today,0)),'limit',7,'reset_at',((today+1)::timestamp at time zone 'Asia/Shanghai'));
end; $$;
create or replace function public.wenxing_admin_dashboard(p_offset integer default 0,p_search text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Shanghai')::date; result jsonb;
begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and raw_app_meta_data->'wenxing_admin'='true'::jsonb) then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 or p_search is null or length(p_search)>200 then raise exception 'Invalid page or search' using errcode='22023'; end if;
 with filtered as (
 select u.id,coalesce(u.email,'') as email,u.created_at,u.email_confirmed_at is not null as verified,
 coalesce(u.raw_app_meta_data->'wenxing_admin'='true'::jsonb,false) as admin,u.last_sign_in_at,a.last_seen,
 coalesce(b.used,0) as used,greatest(0,7-coalesce(b.used,0)) as remaining,w.updated_at as cloud_saved_at
 from auth.users u left join public.wenxing_activity a on a.user_id=u.id
 left join public.wenxing_generation_budget b on b.day=today and b.actor=u.id::text
 left join public.wenxing_workspaces w on w.user_id=u.id
 where p_search='' or strpos(lower(coalesce(u.email,'')),lower(p_search))>0 or strpos(u.id::text,lower(p_search))>0
 ), page_rows as (select * from filtered order by created_at desc,id limit 20 offset p_offset)
 select jsonb_build_object(
 'summary',(select jsonb_build_object('registered',count(*),'verified',count(*) filter(where u.email_confirmed_at is not null),
 'today',count(*) filter(where a.last_seen>=today::timestamp at time zone 'Asia/Shanghai'),
 'online',count(*) filter(where a.last_seen>=now()-interval '2 minutes'),
 'requests',coalesce((select used from public.wenxing_generation_budget where day=today and actor='global'),0)) from auth.users u left join public.wenxing_activity a on a.user_id=u.id),
 'total',(select count(*) from filtered),'offset',p_offset,
 'users',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.id) from page_rows p),'[]'::jsonb),
 'days',(select jsonb_agg(jsonb_build_object('day',d.day::date,'requests',coalesce(b.used,0)) order by d.day)
 from pg_catalog.generate_series((today-29)::timestamp,today::timestamp,interval '1 day') d(day)
 left join public.wenxing_generation_budget b on b.day=d.day::date and b.actor='global')
 ) into result;
 return result;
end; $$;
revoke all on function public.wenxing_quota_status(), public.wenxing_admin_dashboard(integer,text) from public,anon;
grant execute on function public.wenxing_quota_status(), public.wenxing_admin_dashboard(integer,text) to authenticated;
commit;
