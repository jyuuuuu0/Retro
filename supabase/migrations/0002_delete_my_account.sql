-- 로그인한 본인 계정만 삭제. auth.users 삭제 시 profiles, retros 는 on delete cascade 로 함께 삭제된다.
create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on column public.profiles.github_token is 'AES-256-GCM 으로 암호화된 GitHub 토큰 (v1:...). 키는 서버 환경변수 TOKEN_ENCRYPTION_KEY';
