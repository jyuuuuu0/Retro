import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronIcon, CheckIcon } from "@/components/icons";
import { Diff, StateBadge } from "@/components/StateBadge";
import {
  addDays,
  formatDayShort,
  formatYearMonth,
  isValidDate,
  kstStartIso,
  kstToday,
} from "@/lib/date";
import { listMyPRs, type PRSummary } from "@/lib/github";
import { countByDay, currentStreak } from "@/lib/retros";
import { getSession, isAuthError } from "@/lib/session";

export default async function TodayPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const today = kstToday();
  const date = typeof sp.date === "string" && isValidDate(sp.date) && sp.date <= today ? sp.date : today;
  const pendingFirst = sp.sort === "pending";

  const { supabase, user, profile, octokit } = await getSession();

  let prs: PRSummary[] = [];
  let loadError: string | null = null;
  try {
    prs = await listMyPRs(octokit, profile.github_login, date);
  } catch (e) {
    if (isAuthError(e)) redirect("/login?error=token");
    loadError = "GitHub에서 PR을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  const yearAgo = kstStartIso(addDays(today, -400));
  const monthStart = kstStartIso(`${today.slice(0, 7)}-01`);
  const [{ data: written }, { data: history }] = await Promise.all([
    prs.length
      ? supabase.from("retros").select("pr_node_id").eq("user_id", user.id).in("pr_node_id", prs.map((p) => p.nodeId))
      : Promise.resolve({ data: [] as { pr_node_id: string }[] }),
    supabase.from("retros").select("pr_created_at").eq("user_id", user.id).gte("pr_created_at", yearAgo),
  ]);

  const done = new Set((written ?? []).map((r) => r.pr_node_id));
  const counts = countByDay(history ?? []);
  const streak = currentStreak(counts, today);
  const monthCount = (history ?? []).filter((r) => r.pr_created_at >= monthStart).length;

  const doneCount = prs.filter((p) => done.has(p.nodeId)).length;
  const ordered = pendingFirst
    ? [...prs].sort((a, b) => Number(done.has(a.nodeId)) - Number(done.has(b.nodeId)))
    : prs;

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const dateQs = (d: string) => (d === today ? "" : `?date=${d}`);
  const sortHref = (pending: boolean) => {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (pending) params.set("sort", "pending");
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <div className="today-head">
        <div>
          <div className="eyebrow">{formatYearMonth(date)}</div>
          <div className="date-nav">
            <Link href={`/${dateQs(prev)}`} className="icon-btn" aria-label="이전 날">
              <ChevronIcon dir="left" />
            </Link>
            <h1 className="page-title">{formatDayShort(date)}</h1>
            {date < today ? (
              <Link href={`/${dateQs(next)}`} className="icon-btn" aria-label="다음 날">
                <ChevronIcon dir="right" />
              </Link>
            ) : (
              <span className="icon-btn" style={{ opacity: 0.3 }} aria-hidden="true">
                <ChevronIcon dir="right" />
              </span>
            )}
          </div>
        </div>
        {date !== today && (
          <Link href="/" className="btn btn-ghost">
            오늘로 이동
          </Link>
        )}
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="stat-k">{date === today ? "오늘" : "이날"} 회고 진행률</div>
          <div className="stat-v">
            {doneCount} <small>/ {prs.length}</small>
          </div>
          <div className="bar">
            <i style={{ width: prs.length ? `${(doneCount / prs.length) * 100}%` : "0%" }} />
          </div>
        </div>
        <div className="card stat">
          <div className="stat-k">연속 작성</div>
          <div className="stat-v">{streak}일</div>
        </div>
        <div className="card stat">
          <div className="stat-k">이번 달 회고</div>
          <div className="stat-v">{monthCount}개</div>
        </div>
      </div>

      <div className="sec">
        <h2>
          {date === today ? "오늘" : "이날"} 올린 PR <span>{prs.length}</span>
        </h2>
        {prs.length > 1 && (
          <Link href={sortHref(!pendingFirst)} className="sec-link" aria-current={pendingFirst}>
            {pendingFirst ? "올린 순서로 보기" : "미작성 먼저 보기"}
          </Link>
        )}
      </div>

      {loadError ? (
        <div className="card empty">
          <strong>불러오기 실패</strong>
          {loadError}
        </div>
      ) : prs.length === 0 ? (
        <div className="card empty">
          <strong>{date === today ? "오늘 올린 PR이 없어요" : "이날 올린 PR이 없어요"}</strong>
          PR을 올리면 여기에 자동으로 나타나요.
        </div>
      ) : (
        <div className="pr-list">
          {ordered.map((pr) => {
            const isDone = done.has(pr.nodeId);
            const href = `/pr/${pr.owner}/${pr.repo}/${pr.number}${dateQs(date)}`;
            return (
              <Link key={pr.nodeId} href={href} className={`card pr${isDone ? " done" : ""}`}>
                <div className="pr-main">
                  <div className="pr-repo mono">
                    {pr.repoFullName} · #{pr.number}
                  </div>
                  <div className="pr-title">{pr.title}</div>
                  <div className="pr-meta">
                    <StateBadge state={pr.state} />
                    <Diff add={pr.additions} del={pr.deletions} />
                    <span className="muted">
                      파일 {pr.changedFiles} · 커밋 {pr.commits} · 코멘트 {pr.reviews}
                    </span>
                  </div>
                </div>
                {isDone ? (
                  <span className="done-label">
                    <span className="check">
                      <CheckIcon />
                    </span>
                    작성 완료
                  </span>
                ) : (
                  <span className="btn">회고 쓰기</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
