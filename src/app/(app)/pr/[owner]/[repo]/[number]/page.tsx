import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RetroForm } from "@/components/RetroForm";
import { Diff, StateBadge } from "@/components/StateBadge";
import { formatDay, toKstDate } from "@/lib/date";
import { getPRDetail, listMyPRs, type PRDetail } from "@/lib/github";
import type { Retro } from "@/lib/retros";
import { getSession, isAuthError } from "@/lib/session";

export default async function WritePage(props: PageProps<"/pr/[owner]/[repo]/[number]">) {
  const { owner, repo, number: numStr } = await props.params;
  const number = Number(numStr);
  if (!Number.isInteger(number) || number <= 0) notFound();

  const { supabase, user, profile, octokit } = await getSession();

  let pr: PRDetail;
  try {
    pr = await getPRDetail(octokit, owner, repo, number);
  } catch (e) {
    if (isAuthError(e)) redirect("/login?error=token");
    notFound();
  }

  const date = toKstDate(pr.createdAt);

  // 같은 날 PR 중 아직 안 쓴 다음 PR 찾기
  const sameDay = await listMyPRs(octokit, profile.github_login, date).catch(() => []);
  const ids = sameDay.map((p) => p.nodeId);
  const [{ data: retro }, { data: writtenRows }] = await Promise.all([
    supabase
      .from("retros")
      .select("*")
      .eq("user_id", user.id)
      .eq("pr_node_id", pr.nodeId)
      .maybeSingle<Retro>(),
    ids.length
      ? supabase.from("retros").select("pr_node_id").eq("user_id", user.id).in("pr_node_id", ids)
      : Promise.resolve({ data: [] as { pr_node_id: string }[] }),
  ]);
  const written = new Set((writtenRows ?? []).map((r) => r.pr_node_id));
  const pending = sameDay.filter((p) => !written.has(p.nodeId) && p.nodeId !== pr.nodeId);
  const idx = sameDay.findIndex((p) => p.nodeId === pr.nodeId);
  const nextPending =
    sameDay.slice(idx + 1).find((p) => !written.has(p.nodeId)) ?? pending[0] ?? null;

  const backHref = date === toKstDate(new Date()) ? "/" : `/?date=${date}`;
  const nextHref = nextPending
    ? `/pr/${nextPending.owner}/${nextPending.repo}/${nextPending.number}`
    : null;

  const header = (
    <div>
      <div className="crumb">
        <Link href={backHref}>← {formatDay(date)}</Link>
        {sameDay.length > 0 && (
          <span>
            | 남은 PR {pending.length}개
          </span>
        )}
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
        <h3>커밋 {pr.commitList.length}</h3>
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
        {pr.files.length > shownFiles.length && (
          <div className="row muted">외 {pr.files.length - shownFiles.length}개</div>
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

  return (
    <RetroForm
      key={pr.nodeId}
      header={header}
      side={side}
      prUrl={pr.url}
      nextHref={nextHref}
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
