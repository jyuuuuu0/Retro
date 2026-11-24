"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PRState } from "@/lib/github";
import { hasContent } from "@/lib/retros";

export type RetroInput = {
  pr: {
    nodeId: string;
    repoFullName: string;
    number: number;
    title: string;
    url: string;
    state: PRState;
    createdAt: string;
    additions: number;
    deletions: number;
  };
  summary: string;
  learned: string;
  struggled: string;
  next_time: string;
  rating: number | null;
  tags: string[];
};

export type SaveResult = { ok: true; savedAt: string } | { ok: false; error: string };

const MAX_TEXT = 10_000;

function clean(s: string) {
  return s.slice(0, MAX_TEXT);
}

export async function saveRetro(input: RetroInput): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, error: "로그인이 필요해요" };

  const rating = input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null;
  const tags = [...new Set(input.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);

  // 내용을 전부 지우면 '미작성'으로 돌아가도록 행을 지운다.
  if (!hasContent({ ...input, rating, tags })) {
    const { error } = await supabase
      .from("retros")
      .delete()
      .eq("user_id", userId)
      .eq("pr_node_id", input.pr.nodeId);
    if (error) return { ok: false, error: "저장에 실패했어요" };
    return { ok: true, savedAt: new Date().toISOString() };
  }

  const { data, error } = await supabase
    .from("retros")
    .upsert(
      {
        user_id: userId,
        pr_node_id: input.pr.nodeId,
        repo_full_name: input.pr.repoFullName,
        pr_number: input.pr.number,
        pr_title: input.pr.title,
        pr_url: input.pr.url,
        pr_state: input.pr.state,
        pr_created_at: input.pr.createdAt,
        additions: input.pr.additions,
        deletions: input.pr.deletions,
        summary: clean(input.summary),
        learned: clean(input.learned),
        struggled: clean(input.struggled),
        next_time: clean(input.next_time),
        rating,
        tags,
      },
      { onConflict: "user_id,pr_node_id" },
    )
    .select("updated_at")
    .single();

  if (error) return { ok: false, error: "저장에 실패했어요" };
  return { ok: true, savedAt: data.updated_at };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
