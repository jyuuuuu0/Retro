"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GitHubIcon } from "./icons";

export function LoginButton() {
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "read:user repo",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setPending(false);
  }

  return (
    <button type="button" className="btn btn-lg" onClick={signIn} disabled={pending}>
      <GitHubIcon />
      {pending ? "GitHub로 이동 중…" : "GitHub로 시작하기"}
    </button>
  );
}
