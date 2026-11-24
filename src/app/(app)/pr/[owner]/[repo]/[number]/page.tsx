import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RetroForm } from "@/components/RetroForm";
import { Diff, StateBadge } from "@/components/StateBadge";
import { formatDay, kstToday, toKstDate } from "@/lib/date";
import { getPRDetail, listMyPRs } from "@/lib/github";
import type { Retro } from "@/lib/retros";
import { getSession, handleGitHubError } from "@/lib/session";

export default async function WritePage(props: PageProps<"/pr/[owner]/[repo]/[number]">) {
  const { owner, repo, number: numStr } = await props.params;
  const number = Number(numStr);
  if (!Number.isInteger(number) || number <= 0) notFound();

  return (
    <Suspense key={`${owner}/${repo}#${number}`} fallback={<WriteSkeleton />}>
      <WriteContent owner={owner} repo={repo} number={number} />
    </Suspense>
  );
}

async function WriteContent({ owner, repo, number }: { owner: string; repo: string; number: number }) {
  const { supabase, userId, token } = await getSession();

  // PR 상세와 저장된 회고를 동시에
  const [detail, { data: retro }] = await Promise.all([
    getPRDetail(token, owner, repo, number),
    supabase
      .from("retros")
      .select("*")
      .eq("user_id", userId)
      .eq("repo_full_name", `${owner}/${repo}`)
      .eq("pr_number", number)
      .maybeSingle<Retro>(),
  ]);

  if (!detail.ok) {
    handleGitHubError(detail.status);
    notFound();
  }
  const pr = detail.data;
  if (!pr) notFound();

  const date = toKstDate(pr.createdAt);
  const backHref = date === kstToday() ? "/" : `/?date=${date}`;

  const header = (
    <div>
      <div className="crumb">
        <Link href={backHref}>← {formatDay(date)}</Link>
      </div>
      <h1 className="write-title">{pr.title}</h1>
      <div className="write-meta">
        <span className="mono muted">
          {pr.repoFullName} · #{pr.number}
        </span>
        <StateBadge state={pr.state} />
        <Diff add={pr.additions} del={pr.deletions} />
      </div>
    </div>
  );

  const shownFiles = pr.files.slice(0, 8);
  const side = (
    <aside className="card side" aria-label="PR 정보">
      {pr.body.trim() && (
        <div className="blk">
          <h3>PR 본문</h3>
          <div className="pr-body">{pr.body}</div>
        </div>
      )}
      <div className="blk">
        <h3>커밋 {pr.commits}</h3>
        {pr.commitList.map((c) => (
          <div className="row" key={c.sha}>
            <span title={c.message}>{c.message}</span>
            <span className="mono muted">{c.sha.slice(0, 7)}</span>
          </div>
        ))}
      </div>
      <div className="blk">
        <h3>변경 파일 {pr.changedFiles}</h3>
        {shownFiles.map((f) => (
          <div className="row mono" key={f.filename}>
            <span title={f.filename}>{f.filename}</span>
            <span className="nums">
              <span className="add">+{f.additions}</span> <span className="del">−{f.deletions}</span>
            </span>
          </div>
        ))}
        {pr.changedFiles > shownFiles.length && (
          <div className="row muted">외 {pr.changedFiles - shownFiles.length}개</div>
        )}
      </div>
      <div className="blk">
        <h3>받은 리뷰 · 코멘트 {pr.reviewList.length}</h3>
        {pr.reviewList.length === 0 && <div className="row muted">아직 없어요</div>}
        {pr.reviewList.map((r) => (
          <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="cmt" style={{ display: "block" }}>
            <b>{r.author}</b>
            {r.path && <span className="muted"> · {r.path.split("/").pop()}</span>}
            {"\n"}
            {r.body}
          </a>
        ))}
      </div>
    </aside>
  );

  // '다음 PR' 버튼은 따로 늦게 채워서 본문이 먼저 뜨게 한다
  const nextSlot = (
    <Suspense
      fallback={
        <Link href={backHref} className="btn">
          완료
        </Link>
      }
    >
      <NextPRButton date={date} currentNodeId={pr.nodeId} backHref={backHref} />
    </Suspense>
  );

  return (
    <RetroForm
      key={pr.nodeId}
      header={header}
      side={side}
      nextSlot={nextSlot}
      prUrl={pr.url}
      pr={{
        nodeId: pr.nodeId,
        repoFullName: pr.repoFullName,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
        createdAt: pr.createdAt,
        additions: pr.additions,
        deletions: pr.deletions,
      }}
      initial={{
        summary: retro?.summary ?? "",
        learned: retro?.learned ?? "",
        struggled: retro?.struggled ?? "",
        next_time: retro?.next_time ?? "",
        rating: retro?.rating ?? null,
        tags: retro?.tags ?? [],
      }}
      savedAt={retro?.updated_at ?? null}
    />
  );
}

/** 같은 날 PR 중 아직 회고를 안 쓴 다음 PR로 가는 버튼 */
async function NextPRButton({ date, currentNodeId, backHref }: { date: string; currentNodeId: string; backHref: string }) {
  const { supabase, userId, profile, token } = await getSession();
  const res = await listMyPRs(token, profile.github_login, date, date === kstToday());
  const sameDay = res.ok ? res.data : [];
  if (sameDay.length === 0) {
    return (
      <Link href={backHref} className="btn">
        완료
      </Link>
    );
  }

  const { data } = await supabase
    .from("retros")
    .select("pr_node_id")
    .eq("user_id", userId)
    .in("pr_node_id", sameDay.map((p) => p.nodeId));
  const written = new Set((data ?? []).map((r) => r.pr_node_id));

  const idx = sameDay.findIndex((p) => p.nodeId === currentNodeId);
  const pending = sameDay.filter((p) => !written.has(p.nodeId) && p.nodeId !== currentNodeId);
  const next = sameDay.slice(idx + 1).find((p) => !written.has(p.nodeId)) ?? pending[0];

  if (!next) {
    return (
      <Link href={backHref} className="btn">
        완료
      </Link>
    );
  }
  return (
    <Link href={`/pr/${next.owner}/${next.repo}/${next.number}`} className="btn">
      다음 PR → <span style={{ opacity: 0.55, fontWeight: 500 }}>{pending.length}</span>
    </Link>
  );
}

function WriteSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="skeleton" style={{ width: 160, height: 16, marginBottom: 14 }} />
      <div className="skeleton" style={{ width: "60%", height: 34, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 260, height: 20, marginBottom: 28 }} />
      <div className="write-grid">
        <div className="skeleton" style={{ height: 480, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 560, borderRadius: 16 }} />
      </div>
    </div>
  );
}
