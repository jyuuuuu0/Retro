import Link from "next/link";
import { Heatmap, HeatLegend } from "@/components/Heatmap";
import { SearchIcon } from "@/components/icons";
import { addDays, formatDay, kstStartIso, kstToday, toKstDate } from "@/lib/date";
import { countByDay, currentStreak, longestStreak, type Retro } from "@/lib/retros";
import { getSession } from "@/lib/session";

const PERIODS: Record<string, { label: string; days: number | null }> = {
  week: { label: "최근 7일", days: 7 },
  month: { label: "최근 30일", days: 30 },
  quarter: { label: "최근 3개월", days: 90 },
  all: { label: "전체", days: null },
};

function str(v: string | string[] | undefined) {
  return typeof v === "string" ? v.trim() : "";
}

export default async function RecordsPage(props: PageProps<"/records">) {
  const sp = await props.searchParams;
  const q = str(sp.q).slice(0, 100);
  const repo = str(sp.repo);
  const tag = str(sp.tag);
  const rating = Number(str(sp.rating)) || 0;
  const period = PERIODS[str(sp.period)] ? str(sp.period) : "all";

  const { supabase, user } = await getSession();
  const today = kstToday();

  // 잔디 + 필터 옵션용 (최근 1년치 가볍게)
  const { data: meta } = await supabase
    .from("retros")
    .select("pr_created_at, repo_full_name, tags")
    .eq("user_id", user.id)
    .gte("pr_created_at", kstStartIso(addDays(today, -380)));

  const counts = countByDay(meta ?? []);
  const yearTotal = [...counts.values()].reduce((a, b) => a + b, 0);
  const repos = [...new Set((meta ?? []).map((r) => r.repo_full_name))].sort();
  const tags = [...new Set((meta ?? []).flatMap((r) => r.tags as string[]))].sort();

  // 목록
  let query = supabase
    .from("retros")
    .select("*")
    .eq("user_id", user.id)
    .order("pr_created_at", { ascending: false })
    .limit(100);
  const days = PERIODS[period].days;
  if (days) query = query.gte("pr_created_at", kstStartIso(addDays(today, -(days - 1))));
  if (repo) query = query.eq("repo_full_name", repo);
  if (tag) query = query.contains("tags", [tag]);
  if (rating >= 1 && rating <= 5) query = query.eq("rating", rating);
  if (q) {
    const like = `%${q.replace(/[%_,()\\]/g, " ")}%`;
    query = query.or(
      ["pr_title", "summary", "learned", "struggled", "next_time"].map((c) => `${c}.ilike.${like}`).join(","),
    );
  }
  const { data: list } = await query.returns<Retro[]>();

  const groups = new Map<string, Retro[]>();
  for (const r of list ?? []) {
    const d = toKstDate(r.pr_created_at);
    groups.set(d, [...(groups.get(d) ?? []), r]);
  }
  const filtered = !!(q || repo || tag || rating || period !== "all");

  return (
    <>
      <h1 className="page-title" style={{ marginBottom: 28 }}>
        기록
      </h1>

      <section className="card heat" aria-label="회고 잔디">
        <div className="heat-head">
          <b>지난 1년 동안 회고 {yearTotal}개</b>
          <span className="muted" style={{ fontSize: 13 }}>
            연속 {currentStreak(counts, today)}일 · 최장 {longestStreak(counts)}일
          </span>
        </div>
        <Heatmap counts={counts} today={today} />
        <div className="heat-foot">
          <span>PR을 올린 날 기준 · 하루 회고 수</span>
          <HeatLegend />
        </div>
      </section>

      <form className="filters" method="get" role="search">
        <label className="pill search">
          <SearchIcon />
          <input name="q" defaultValue={q} placeholder="회고 내용, PR 제목 검색" aria-label="검색어" />
        </label>
        <select name="period" defaultValue={period} className="pill" aria-label="기간">
          {Object.entries(PERIODS).map(([k, v]) => (
            <option key={k} value={k}>
              기간 · {v.label}
            </option>
          ))}
        </select>
        <select name="repo" defaultValue={repo} className="pill" aria-label="레포">
          <option value="">레포 · 전체</option>
          {repos.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="tag" defaultValue={tag} className="pill" aria-label="태그">
          <option value="">태그 · 전체</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="rating" defaultValue={rating ? String(rating) : ""} className="pill" aria-label="만족도">
          <option value="">만족도 · 전체</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              만족도 {n}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          적용
        </button>
        {filtered && (
          <Link href="/records" className="sec-link">
            초기화
          </Link>
        )}
      </form>

      {groups.size === 0 ? (
        <div className="card empty" style={{ marginTop: 24 }}>
          <strong>{filtered ? "조건에 맞는 회고가 없어요" : "아직 쓴 회고가 없어요"}</strong>
          {filtered ? "필터를 바꿔보세요." : "오늘 올린 PR부터 회고를 남겨보세요."}
        </div>
      ) : (
        [...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <div className="day-label">
              {formatDay(day)} · {items.length}개
            </div>
            {items.map((r) => {
              const [owner, name] = r.repo_full_name.split("/");
              const preview = r.learned || r.summary || r.struggled || r.next_time;
              return (
                <Link key={r.id} href={`/pr/${owner}/${name}/${r.pr_number}`} className="card item">
                  <div className="item-t">{r.pr_title}</div>
                  <p>{preview.length > 180 ? `${preview.slice(0, 180)}…` : preview}</p>
                  <div className="item-r">
                    <span className="mono muted" style={{ fontSize: 13 }}>
                      {name} · #{r.pr_number}
                    </span>
                    {r.tags.length > 0 && (
                      <div className="tags">
                        {r.tags.slice(0, 4).map((t) => (
                          <span className="tag" key={t}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.rating && <span className="rate">만족도 {r.rating}</span>}
                  </div>
                </Link>
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
