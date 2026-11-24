import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { decryptToken, encryptToken } from "./crypto";
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

  const decrypted = decryptToken(profile.github_token, userId);
  if (!decrypted) redirect("/login?error=token");

  // 예전에 평문으로 저장된 토큰은 이번에 암호화해서 다시 저장
  if (decrypted.legacy) {
    await supabase
      .from("profiles")
      .update({ github_token: encryptToken(decrypted.token, userId) })
      .eq("id", userId);
  }

  return { supabase, userId, profile, token: decrypted.token };
});

/** GitHub 토큰이 만료·취소됐을 때(401) 다시 로그인하게 한다. */
export function handleGitHubError(status: number): never | void {
  if (status === 401) redirect("/login?error=token");
}
