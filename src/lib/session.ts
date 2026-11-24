import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string;
  github_login: string;
  avatar_url: string | null;
  github_token: string | null;
};

/**
 * 로그인한 사용자 + 프로필. 없으면 로그인 화면으로 보낸다.
 * getClaims()는 JWT를 로컬에서 검증해서 Auth 서버 왕복이 없다.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, github_login, avatar_url, github_token")
    .eq("id", userId)
    .single<Profile>();

  if (!profile?.github_token) redirect("/login?error=token");

  return { supabase, userId, profile, token: profile.github_token };
});

/** GitHub 토큰이 만료·취소됐을 때(401) 다시 로그인하게 한다. */
export function handleGitHubError(status: number): never | void {
  if (status === 401) redirect("/login?error=token");
}
