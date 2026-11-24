import "server-only";
import { Octokit } from "@octokit/rest";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Profile = {
  id: string;
  github_login: string;
  avatar_url: string | null;
  github_token: string | null;
};

/** 로그인한 사용자 + 프로필. 없으면 로그인 화면으로 보낸다. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, github_login, avatar_url, github_token")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile?.github_token) redirect("/login?error=token");

  const octokit = new Octokit({ auth: profile.github_token, userAgent: "retro-app" });
  return { supabase, user, profile, octokit };
});

/** GitHub 토큰이 만료·취소됐을 때(401) 다시 로그인하게 한다. */
export function isAuthError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "status" in e && (e as { status: number }).status === 401;
}
