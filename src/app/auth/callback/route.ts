import { NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const meta = data.user.user_metadata ?? {};
      const login: string = meta.user_name ?? meta.preferred_username ?? "";
      const token = data.session.provider_token;

      // provider_token은 이 순간에만 받을 수 있어서 바로 저장한다.
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        github_login: login,
        avatar_url: meta.avatar_url ?? null,
        ...(token ? { github_token: encryptToken(token, data.user.id) } : {}),
      });

      if (!upsertError) return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
