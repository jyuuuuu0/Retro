-- retro: 개인용 PR 회고 서비스 초기 스키마

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  github_login text not null,
  avatar_url text,
  -- GitHub OAuth 토큰. 로그인 직후에만 받을 수 있어서 저장해 둔다.
  github_token text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.retros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- PR 스냅샷 (기록 화면은 GitHub API 없이 이것만으로 그린다)
  pr_node_id text not null,
  repo_full_name text not null,
  pr_number integer not null,
  pr_title text not null,
  pr_url text not null,
  pr_state text not null check (pr_state in ('open', 'merged', 'closed')),
  pr_created_at timestamptz not null,
  additions integer not null default 0,
  deletions integer not null default 0,

  -- 회고
  summary text not null default '',
  learned text not null default '',
  struggled text not null default '',
  next_time text not null default '',
  rating smallint check (rating between 1 and 5),
  tags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pr_node_id)
);

create index if not exists retros_user_created_idx on public.retros (user_id, pr_created_at desc);
create index if not exists retros_tags_idx on public.retros using gin (tags);

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists retros_updated_at on public.retros;
create trigger retros_updated_at before update on public.retros
  for each row execute function public.set_updated_at();

-- RLS: 본인 행만
alter table public.profiles enable row level security;
alter table public.retros enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "retros: own rows" on public.retros;
create policy "retros: own rows" on public.retros
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
