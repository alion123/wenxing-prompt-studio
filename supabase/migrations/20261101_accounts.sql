begin;
create table if not exists public.wenxing_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 workspace jsonb not null check(jsonb_typeof(workspace) = 'object' and octet_length(workspace::text) <= 10485760),
 revision bigint not null default 1 check(revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.wenxing_workspaces enable row level security;
revoke all on table public.wenxing_workspaces from anon;
grant select,insert,update on table public.wenxing_workspaces to authenticated;
drop policy if exists wenxing_owner on public.wenxing_workspaces;
create policy wenxing_owner on public.wenxing_workspaces for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.wenxing_save_workspace(p_workspace jsonb,p_expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare result bigint; owner_id uuid := auth.uid();
begin
 if owner_id is null then raise exception '请先登录' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision < 0 or jsonb_typeof(p_workspace) is distinct from 'object' or jsonb_typeof(p_workspace->'projects') is distinct from 'array' or jsonb_typeof(p_workspace->'active') is distinct from 'string' or octet_length(p_workspace::text) > 10485760 then raise exception '工作区格式不正确或超过10MB' using errcode='22023'; end if;
 if p_expected_revision=0 then
  insert into public.wenxing_workspaces(user_id,workspace) values(owner_id,p_workspace) on conflict do nothing returning revision into result;
 else
  update public.wenxing_workspaces set workspace=p_workspace,revision=revision+1,updated_at=now() where user_id=owner_id and revision=p_expected_revision returning revision into result;
 end if;
 if result is null then raise exception '云端已有新版本，请先载入云端内容再保存' using errcode='40001'; end if;
 return result;
end;
$$;
revoke all on function public.wenxing_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.wenxing_save_workspace(jsonb,bigint) to authenticated;
commit;
