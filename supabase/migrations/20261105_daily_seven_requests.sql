-- Apply after 20261105_generation_budget.sql. Keep today's existing counters.
begin;
create or replace function public.wenxing_consume_generation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=auth.uid();
  moment timestamptz:=clock_timestamp();
  today date:=(moment at time zone 'Asia/Shanghai')::date;
  reset_at timestamptz:=((today+1)::timestamp at time zone 'Asia/Shanghai');
  global_used integer; person public.wenxing_generation_budget%rowtype;
  wait_seconds integer; metadata jsonb;
begin
  if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode='42501';
  end if;
  -- Lock the shared bucket first, preserving atomic reservations across devices.
  insert into public.wenxing_generation_budget(day,actor) values(today,'global') on conflict do nothing;
  select used into global_used from public.wenxing_generation_budget where day=today and actor='global' for update;
  insert into public.wenxing_generation_budget(day,actor) values(today,owner_id::text) on conflict do nothing;
  select * into person from public.wenxing_generation_budget where day=today and actor=owner_id::text for update;
  metadata:=jsonb_build_object('remaining',greatest(0,7-person.used),'limit',7,'reset_at',reset_at);
  wait_seconds:=greatest(1,ceil(extract(epoch from (reset_at-moment)))::integer);
  if person.used>=7 then return metadata||jsonb_build_object('allowed',false,'reason','account_daily','retry_after',wait_seconds); end if;
  if global_used>=200 then return metadata||jsonb_build_object('allowed',false,'reason','site_daily','retry_after',wait_seconds); end if;
  if person.last_request>moment-interval '10 seconds' then
    return metadata||jsonb_build_object('allowed',false,'reason','interval','retry_after',greatest(1,ceil(extract(epoch from (person.last_request+interval '10 seconds'-moment)))::integer));
  end if;
  update public.wenxing_generation_budget set used=used+1,last_request=moment where day=today and actor in ('global',owner_id::text);
  return jsonb_build_object('allowed',true,'remaining',6-person.used,'limit',7,'reset_at',reset_at);
end;
$$;
revoke all on function public.wenxing_consume_generation() from public,anon;
grant execute on function public.wenxing_consume_generation() to authenticated;
commit;
