import type { PRState } from "./github";
import { addDays, kstToday, toKstDate } from "./date";

export type Retro = {
  id: string;
  pr_node_id: string;
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  pr_state: PRState;
  pr_created_at: string;
  additions: number;
  deletions: number;
  summary: string;
  learned: string;
  struggled: string;
  next_time: string;
  rating: number | null;
  tags: string[];
  updated_at: string;
};

export function hasContent(r: Pick<Retro, "summary" | "learned" | "struggled" | "next_time" | "rating" | "tags">) {
  return !!(
    r.summary.trim() ||
    r.learned.trim() ||
    r.struggled.trim() ||
    r.next_time.trim() ||
    r.rating ||
    r.tags.length
  );
}

/** pr_created_at 목록 → KST 날짜별 회고 수 */
export function countByDay(rows: { pr_created_at: string }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = toKstDate(r.pr_created_at);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return map;
}

/** 오늘(또는 오늘 아직 안 썼으면 어제)부터 거꾸로 이어진 날 수 */
export function currentStreak(counts: Map<string, number>, today = kstToday()): number {
  let day = counts.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (counts.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(counts: Map<string, number>): number {
  const days = [...counts.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
