import "server-only";
import type { Octokit } from "@octokit/rest";
import { kstDayRange } from "./date";

export type PRState = "open" | "merged" | "closed";

export type PRSummary = {
  nodeId: string;
  owner: string;
  repo: string;
  repoFullName: string;
  number: number;
  title: string;
  url: string;
  state: PRState;
  createdAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  reviews: number;
};

type PullData = Awaited<ReturnType<Octokit["rest"]["pulls"]["get"]>>["data"];

function stateOf(pr: Pick<PullData, "state" | "merged_at">): PRState {
  if (pr.merged_at) return "merged";
  return pr.state === "open" ? "open" : "closed";
}

function toSummary(pr: PullData, owner: string, repo: string): PRSummary {
  return {
    nodeId: pr.node_id,
    owner,
    repo,
    repoFullName: `${owner}/${repo}`,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    state: stateOf(pr),
    createdAt: pr.created_at,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
    commits: pr.commits,
    reviews: pr.review_comments + pr.comments,
  };
}

/** 그날(KST) 내가 만든 PR 목록. 최신순. */
export async function listMyPRs(octokit: Octokit, login: string, date: string): Promise<PRSummary[]> {
  const q = `is:pr author:${login} created:${kstDayRange(date)}`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    per_page: 50,
    sort: "created",
    order: "desc",
  });

  const refs = data.items.map((item) => {
    // repository_url: https://api.github.com/repos/{owner}/{repo}
    const [owner, repo] = item.repository_url.split("/repos/")[1].split("/");
    return { owner, repo, number: item.number };
  });

  const pulls = await Promise.all(
    refs.map(async ({ owner, repo, number }) => {
      try {
        const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
        return toSummary(pr, owner, repo);
      } catch {
        return null; // 접근 권한이 없어진 레포 등은 건너뛴다
      }
    }),
  );
  return pulls.filter((p): p is PRSummary => p !== null);
}

export type PRDetail = PRSummary & {
  body: string;
  commitList: { sha: string; message: string }[];
  files: { filename: string; additions: number; deletions: number }[];
  reviewList: { id: number; author: string; body: string; path?: string; url: string }[];
};

export async function getPRDetail(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
): Promise<PRDetail> {
  const base = { owner, repo, pull_number: number };
  const [pr, commits, files, reviews, comments] = await Promise.all([
    octokit.rest.pulls.get(base),
    octokit.rest.pulls.listCommits({ ...base, per_page: 100 }),
    octokit.rest.pulls.listFiles({ ...base, per_page: 100 }),
    octokit.rest.pulls.listReviews({ ...base, per_page: 100 }),
    octokit.rest.pulls.listReviewComments({ ...base, per_page: 100 }),
  ]);

  const reviewList = [
    ...reviews.data
      .filter((r) => r.body?.trim())
      .map((r) => ({
        id: r.id,
        author: r.user?.login ?? "unknown",
        body: r.body,
        url: r.html_url,
        at: r.submitted_at ?? "",
      })),
    ...comments.data.map((c) => ({
      id: c.id,
      author: c.user?.login ?? "unknown",
      body: c.body,
      path: c.path,
      url: c.html_url,
      at: c.created_at,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ at, ...rest }) => rest);

  return {
    ...toSummary(pr.data, owner, repo),
    body: pr.data.body ?? "",
    commitList: commits.data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
    })),
    files: files.data.map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
    })),
    reviewList,
  };
}
