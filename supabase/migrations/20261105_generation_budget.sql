begin;
create table if not exists public.wenxing_generation_budget(
  day date not null,
  actor text not null,
  used integer not null default 0 check(used>=0),
  last_request timestamptz,
  primary key(day,actor)
);
alter table public.wenxing_generation_budget enable row level security;
revoke all on public.wenxing_generation_budget from public,anon,authenticated;

create or replace function public.wenxing_consume_generation()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=auth.uid();
  moment timestamptz:=clock_timestamp();
  today date:=(moment at time zone 'Asia/Shanghai')::date;
  global_used integer; person public.wenxing_generation_budget%rowtype;
  wait_seconds integer;
begin
  if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then
    raise exception 'Verified account required' using errcode='42501';
  end if;
  -- Always lock the shared bucket first; serializes reservations across devices/accounts.
  insert into public.wenxing_generation_budget(day,actor) values(today,'global') on conflict do nothing;
  select used into global_used from public.wenxing_generation_budget where day=today and actor='global' for update;
  insert into public.wenxing_generation_budget(day,actor) values(today,owner_id::text) on conflict do nothing;
  select * into person from public.wenxing_generation_budget where day=today and actor=owner_id::text for update;
  wait_seconds:=greatest(1,ceil(extract(epoch from (((today+1)::timestamp at time zone 'Asia/Shanghai')-moment)))::integer);
  if person.used>=20 then return jsonb_build_object('allowed',false,'reason','account_daily','retry_after',wait_seconds); end if;
  if global_used>=200 then return jsonb_build_object('allowed',false,'reason','site_daily','retry_after',wait_seconds); end if;
  if person.last_request>moment-interval '10 seconds' then
    return jsonb_build_object('allowed',false,'reason','interval','retry_after',greatest(1,ceil(extract(epoch from (person.last_request+interval '10 seconds'-moment)))::integer));
  end if;
  update public.wenxing_generation_budget set used=used+1,last_request=moment where day=today and actor in ('global',owner_id::text);
  return jsonb_build_object('allowed',true,'remaining',19-person.used);
end;
$$;
revoke all on function public.wenxing_consume_generation() from public,anon;
grant execute on function public.wenxing_consume_generation() to authenticated;
commit;
