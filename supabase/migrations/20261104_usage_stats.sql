begin;
create table if not exists public.wenxing_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null
);
alter table public.wenxing_activity enable row level security;
revoke all on public.wenxing_activity from public, anon, authenticated;

create or replace function public.wenxing_heartbeat()
returns void language sql security definer set search_path = '' as $$
  insert into public.wenxing_activity as activity (user_id, last_seen)
  select id, now() from auth.users
  where id = auth.uid() and email_confirmed_at is not null
  on conflict (user_id) do update set last_seen = excluded.last_seen
  where activity.last_seen < excluded.last_seen - interval '30 seconds';
$$;

create or replace function public.wenxing_usage_stats()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.users where id = auth.uid()
    and email_confirmed_at is not null
    and raw_app_meta_data -> 'wenxing_admin' = 'true'::jsonb
  ) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'registered', count(*),
      'verified', count(*) filter (where u.email_confirmed_at is not null),
      'today', count(*) filter (where a.last_seen >= date_trunc('day', now(), 'Asia/Shanghai')),
      'online', count(*) filter (where a.last_seen >= now() - interval '2 minutes')
    )
    from auth.users u left join public.wenxing_activity a on a.user_id = u.id
  );
end;
$$;
revoke all on function public.wenxing_heartbeat(), public.wenxing_usage_stats() from public, anon;
grant execute on function public.wenxing_heartbeat(), public.wenxing_usage_stats() to authenticated;
commit;
