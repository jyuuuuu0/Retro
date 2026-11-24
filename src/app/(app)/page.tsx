import Link from "next/link";
import { Suspense } from "react";
import { ChevronIcon, CheckIcon } from "@/components/icons";
import { DatePicker } from "@/components/DatePicker";
import { Diff, StateBadge } from "@/components/StateBadge";
import { addDays, formatDay, formatDayShort, formatYearMonth, isValidDate, kstStartIso, kstToday, toKstDate } from "@/lib/date";
import { latestPRBefore, listMyPRs } from "@/lib/github";
import { countByDay, currentStreak } from "@/lib/retros";
import { getSession, handleGitHubError } from "@/lib/session";

export default async function TodayPage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const today = kstToday();
  const date = typeof sp.date === "string" && isValidDate(sp.date) && sp.date <= today ? sp.date : today;
  const pendingFirst = sp.sort === "pending";

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const dateHref = (d: string) => (d === today ? "/" : `/?date=${d}`);

  // 날짜 헤더는 바로 바뀌고, 아래 내용만 스켈레톤 → 로드
  return (
    <>
      <div className="today-head">
        <div>
          <div className="eyebrow">{formatYearMonth(date)}</div>
          <div className="date-nav">
            <Link href={dateHref(prev)} className="icon-btn" aria-label="이전 날">
              <ChevronIcon dir="left" />
            </Link>
            <h1 className="page-title">{formatDayShort(date)}</h1>
            {date < today ? (
              <Link href={dateHref(next)} className="icon-btn" aria-label="다음 날">
                <ChevronIcon dir="right" />
              </Link>
            ) : (
              <span className="icon-btn" style={{ opacity: 0.3 }} aria-hidden="true">
                <ChevronIcon dir="right" />
              </span>
            )}
          </div>
        </div>
        <div className="head-actions">
          <DatePicker date={date} today={today} />
          {date !== today && (
            <Link href="/" className="btn btn-ghost">
              오늘로 이동
            </Link>
          )}
        </div>
      </div>

      <Suspense key={`${date}:${pendingFirst}`} fallback={<TodaySkeleton />}>
        <TodayContent date={date} today={today} pendingFirst={pendingFirst} />
      </Suspense>
    </>
  );
}

async function TodayContent({ date, today, pendingFirst }: { date: string; today: string; pendingFirst: boolean }) {
  const { supabase, userId, profile, token } = await getSession();

  const dayStart = kstStartIso(date);
  const dayEnd = kstStartIso(addDays(date, 1));
  const monthStart = kstStartIso(`${today.slice(0, 7)}-01`);

  // GitHub와 DB 조회를 한꺼번에
  const [prRes, { data: written }, { data: history }] = await Promise.all([
    listMyPRs(token, profile.github_login, date, date === today),
    supabase
      .from("retros")
      .select("pr_node_id")
      .eq("user_id", userId)
      .gte("pr_created_at", dayStart)
      .lt("pr_created_at", dayEnd),
    supabase
      .from("retros")
      .select("pr_created_at")
      .eq("user_id", userId)
      .gte("pr_created_at", kstStartIso(addDays(today, -400))),
  ]);

  if (!prRes.ok) handleGitHubError(prRes.status);
  const prs = prRes.ok ? prRes.data : [];

  const done = new Set((written ?? []).map((r) => r.pr_node_id));
  const counts = countByDay(history ?? []);
  const streak = currentStreak(counts, today);
  const monthCount = (history ?? []).filter((r) => r.pr_created_at >= monthStart).length;

  const doneCount = prs.filter((p) => done.has(p.nodeId)).length;
  const ordered = pendingFirst
    ? [...prs].sort((a, b) => Number(done.has(a.nodeId)) - Number(done.has(b.nodeId)))
    : prs;

  const label = date === today ? "오늘" : "이날";
  const sortHref = (pending: boolean) => {
    const params = new URLSearchParams();
    if (date !== today) params.set("date", date);
    if (pending) params.set("sort", "pending");
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <div className="stats">
        <div className="card stat">
          <div className="stat-k">{label} 회고 진행률</div>
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
          {label} 올린 PR <span>{prs.length}</span>
        </h2>
        {prs.length > 1 && (
          <Link href={sortHref(!pendingFirst)} className="sec-link" aria-current={pendingFirst}>
            {pendingFirst ? "올린 순서로 보기" : "미작성 먼저 보기"}
          </Link>
        )}
      </div>

      {!prRes.ok ? (
        <div className="card empty">
          <strong>불러오기 실패</strong>
          GitHub에서 PR을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </div>
      ) : prs.length === 0 ? (
        <div className="card empty">
          <strong>{label} 올린 PR이 없어요</strong>
          PR을 올리면 여기에 자동으로 나타나요.
          <Suspense fallback={null}>
            <LatestPRLink token={token} login={profile.github_login} date={date} today={today} />
          </Suspense>
        </div>
      ) : (
        <div className="pr-list">
          {ordered.map((pr) => {
            const isDone = done.has(pr.nodeId);
            return (
              <Link
                key={pr.nodeId}
                href={`/pr/${pr.owner}/${pr.repo}/${pr.number}`}
                className={`card pr${isDone ? " done" : ""}`}
              >
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

/** 빈 날이면 가장 최근에 PR을 올린 날로 바로 가는 버튼 */
async function LatestPRLink({ token, login, date, today }: { token: string; login: string; date: string; today: string }) {
  const at = await latestPRBefore(token, login, date);
  if (!at) return null;
  const d = toKstDate(at);
  return (
    <div>
      <Link href={d === today ? "/" : `/?date=${d}`} className="btn btn-ghost">
        최근 PR이 있는 날로 · {formatDay(d)}
      </Link>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="stats">
        <div className="skeleton" style={{ height: 112, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 112, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 112, borderRadius: 16 }} />
      </div>
      <div className="skeleton" style={{ width: 140, height: 22, marginBottom: 14 }} />
      <div className="pr-list">
        <div className="skeleton" style={{ height: 104, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 104, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 104, borderRadius: 16 }} />
      </div>
    </div>
  );
}
