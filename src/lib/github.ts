import "server-only";
import { Octokit } from "@octokit/rest";
import { cacheLife, cacheTag } from "next/cache";
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

export type PRDetail = PRSummary & {
  body: string;
  commitList: { sha: string; message: string }[];
  files: { filename: string; additions: number; deletions: number }[];
  reviewList: { id: string; author: string; body: string; path?: string; url: string }[];
};

/** 캐시 함수는 throw 대신 결과로 에러 상태를 돌려준다 (401이면 다시 로그인) */
export type GHResult<T> = { ok: true; data: T } | { ok: false; status: number };

function client(token: string) {
  return new Octokit({ auth: token, userAgent: "retro-app" });
}

/**
 * GraphQL은 일부 노드에 접근 권한이 없으면(예: OAuth 앱을 승인하지 않은 org 레포)
 * 데이터는 주면서 errors도 같이 준다. octokit은 이때 throw 하므로 받은 데이터는 살려서 쓴다.
 */
async function gql<T>(token: string, query: string, vars: Record<string, unknown>): Promise<T> {
  try {
    return await client(token).graphql<T>(query, vars);
  } catch (e) {
    if (e instanceof Error && e.name === "GraphqlResponseError" && "data" in e && e.data) {
      return e.data as T;
    }
    throw e;
  }
}

function statusOf(e: unknown): number {
  if (typeof e === "object" && e !== null && "status" in e) return Number((e as { status: number }).status);
  return 500;
}

type PRNode = {
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: { totalCount: number };
  comments: { totalCount: number };
  reviews: { totalCount: number };
  repository: { name: string; nameWithOwner: string; owner: { login: string } };
};

const PR_FIELDS = `
  id number title url state createdAt additions deletions changedFiles
  commits { totalCount }
  comments { totalCount }
  reviews { totalCount }
  repository { name nameWithOwner owner { login } }
`;

function toSummary(n: PRNode): PRSummary {
  return {
    nodeId: n.id,
    owner: n.repository.owner.login,
    repo: n.repository.name,
    repoFullName: n.repository.nameWithOwner,
    number: n.number,
    title: n.title,
    url: n.url,
    state: n.state.toLowerCase() as PRState,
    createdAt: n.createdAt,
    additions: n.additions,
    deletions: n.deletions,
    changedFiles: n.changedFiles,
    commits: n.commits.totalCount,
    reviews: n.comments.totalCount + n.reviews.totalCount,
  };
}

/**
 * 그날(KST) 내가 만든 PR 목록. GraphQL 한 번으로 가져오고 서버에 잠깐 캐시한다.
 * 오늘은 1분, 지난 날짜는 10분마다 새로 확인한다.
 */
export async function listMyPRs(
  token: string,
  login: string,
  date: string,
  isToday: boolean,
): Promise<GHResult<PRSummary[]>> {
  "use cache";
  cacheTag(`prs:${login}:${date}`);

  try {
    const q = `is:pr author:${login} created:${kstDayRange(date)} sort:created-desc`;
    const res = await gql<{ search: { nodes: (PRNode | Record<string, never> | null)[] } }>(
      token,
      `query($q: String!) {
        search(query: $q, type: ISSUE, first: 50) {
          nodes { ... on PullRequest { ${PR_FIELDS} } }
        }
      }`,
      { q },
    );
    const prs = res.search.nodes.filter((n): n is PRNode => !!n && "id" in n).map(toSummary);
    // 오늘은 1분, 지난 날짜는 10분마다 새로 확인
    if (isToday) cacheLife({ stale: 30, revalidate: 60, expire: 600 });
    else cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
    return { ok: true, data: prs };
  } catch (e) {
    cacheLife("seconds"); // 실패는 오래 기억하지 않는다
    return { ok: false, status: statusOf(e) };
  }
}

type Author = { login: string } | null;
type DetailNode = PRNode & {
  body: string;
  commitList: { nodes: { commit: { oid: string; messageHeadline: string } }[] };
  files: { nodes: { path: string; additions: number; deletions: number }[] } | null;
  reviewList: {
    nodes: {
      id: string;
      author: Author;
      body: string;
      url: string;
      submittedAt: string | null;
      comments: { nodes: { id: string; author: Author; body: string; path: string; url: string; createdAt: string }[] };
    }[];
  };
  issueComments: { nodes: { id: string; author: Author; body: string; url: string; createdAt: string }[] };
};

/** PR 상세 (커밋·파일·리뷰·코멘트)를 GraphQL 한 번으로. 2분 캐시. */
export async function getPRDetail(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<GHResult<PRDetail | null>> {
  "use cache";
  cacheTag(`pr:${owner}/${repo}#${number}`);

  try {
    const res = await gql<{ repository: { pullRequest: DetailNode | null } | null }>(
      token,
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            ${PR_FIELDS}
            body
            commitList: commits(first: 100) { nodes { commit { oid messageHeadline } } }
            files(first: 100) { nodes { path additions deletions } }
            reviewList: reviews(first: 50) {
              nodes {
                id author { login } body url submittedAt
                comments(first: 30) { nodes { id author { login } body path url createdAt } }
              }
            }
            issueComments: comments(first: 50) { nodes { id author { login } body url createdAt } }
          }
        }
      }`,
      { owner, repo, number },
    );

    const pr = res.repository?.pullRequest;
    if (!pr) {
      cacheLife("seconds");
      return { ok: true, data: null };
    }
    cacheLife({ stale: 60, revalidate: 120, expire: 1800 });

    const reviewList = [
      ...pr.reviewList.nodes.filter(Boolean).flatMap((r) => [
        ...(r.body.trim()
          ? [{ id: r.id, author: r.author?.login ?? "unknown", body: r.body, path: undefined as string | undefined, url: r.url, at: r.submittedAt ?? "" }]
          : []),
        ...r.comments.nodes.filter(Boolean).map((c) => ({
          id: c.id,
          author: c.author?.login ?? "unknown",
          body: c.body,
          path: c.path as string | undefined,
          url: c.url,
          at: c.createdAt,
        })),
      ]),
      ...pr.issueComments.nodes.filter(Boolean).map((c) => ({
        id: c.id,
        author: c.author?.login ?? "unknown",
        body: c.body,
        path: undefined as string | undefined,
        url: c.url,
        at: c.createdAt,
      })),
    ]
      .sort((a, b) => a.at.localeCompare(b.at))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ at, ...rest }) => rest);

    return {
      ok: true,
      data: {
        ...toSummary(pr),
        body: pr.body ?? "",
        commitList: pr.commitList.nodes.map((c) => ({ sha: c.commit.oid, message: c.commit.messageHeadline })),
        files: (pr.files?.nodes ?? []).map((f) => ({ filename: f.path, additions: f.additions, deletions: f.deletions })),
        reviewList,
      },
    };
  } catch (e) {
    cacheLife("seconds");
    return { ok: false, status: statusOf(e) };
  }
}

/** date(KST) 이전에 내가 마지막으로 PR을 만든 시각. 빈 날에 '최근 PR 날짜로 이동'을 보여주는 데 쓴다. */
export async function latestPRBefore(token: string, login: string, date: string): Promise<string | null> {
  "use cache";
  cacheTag(`prs:${login}:before:${date}`);
  try {
    const q = `is:pr author:${login} created:<${date}T00:00:00+09:00 sort:created-desc`;
    const res = await gql<{ search: { nodes: ({ createdAt: string } | Record<string, never> | null)[] } }>(
      token,
      `query($q: String!) {
        search(query: $q, type: ISSUE, first: 1) {
          nodes { ... on PullRequest { createdAt } }
        }
      }`,
      { q },
    );
    const node = res.search.nodes.find((n): n is { createdAt: string } => !!n && "createdAt" in n);
    cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
    return node?.createdAt ?? null;
  } catch {
    cacheLife("seconds");
    return null;
  }
}
