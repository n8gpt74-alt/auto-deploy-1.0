import { NextRequest, NextResponse } from "next/server";
import { getGitHubAccessToken } from "@/lib/github-token";

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_QUERY"
  | "GITHUB_TOKEN_INVALID"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_FORBIDDEN"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_UPSTREAM_ERROR"
  | "GITHUB_TIMEOUT"
  | "GITHUB_NETWORK_ERROR";

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
};

const GITHUB_TIMEOUT_MS = 8000;
const MAX_COMMITS = 5;
const OWNER_PATTERN = /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function errorResponse(status: number, code: ApiErrorCode, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

function githubErrorResponse(status: number, headers: Headers) {
  if (status === 401) return errorResponse(401, "GITHUB_TOKEN_INVALID", "GitHub token is invalid or expired.");
  if (status === 403) {
    const remaining = headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = headers.get("x-ratelimit-reset");
      return errorResponse(429, "GITHUB_RATE_LIMITED", "GitHub API rate limit exceeded", {
        resetAt: reset ? Number(reset) * 1000 : null,
      });
    }
    return errorResponse(403, "GITHUB_FORBIDDEN", "No access to this repository");
  }
  if (status === 404) return errorResponse(404, "GITHUB_NOT_FOUND", "Repository or branch not found");
  return errorResponse(502, "GITHUB_UPSTREAM_ERROR", "Failed to fetch commits from GitHub");
}

export async function GET(req: NextRequest) {
  const accessToken = await getGitHubAccessToken(req);
  if (!accessToken) return errorResponse(401, "UNAUTHORIZED", "Unauthorized");

  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");

  if (!owner || !repo) return errorResponse(400, "INVALID_QUERY", "Missing required query params: owner, repo");
  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo)) return errorResponse(400, "INVALID_QUERY", "Invalid owner or repo format.");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({ per_page: String(MAX_COMMITS) });
    if (branch) params.set("sha", branch);

    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!res.ok) return githubErrorResponse(res.status, res.headers);

    const commits = (await res.json()) as GitHubCommit[];
    if (!Array.isArray(commits)) {
      return NextResponse.json({ commits: [] }, { headers: { "Cache-Control": "private, max-age=30" } });
    }

    const normalized = commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      fullSha: c.sha,
      message: c.commit.message.split("\n")[0].slice(0, 120),
      author: c.author?.login ?? c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));

    return NextResponse.json(
      { commits: normalized },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(504, "GITHUB_TIMEOUT", "GitHub request timed out.");
    }
    return errorResponse(502, "GITHUB_NETWORK_ERROR", "GitHub is temporarily unavailable.");
  } finally {
    clearTimeout(timeoutId);
  }
}
