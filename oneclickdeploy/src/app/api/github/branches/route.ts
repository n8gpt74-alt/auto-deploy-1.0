import { NextRequest, NextResponse } from "next/server";
import { getGitHubAccessToken } from "@/lib/github-token";

type GitHubBranch = {
  name: string;
  protected: boolean;
};

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_QUERY"
  | "GITHUB_TOKEN_INVALID"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_FORBIDDEN"
  | "GITHUB_NOT_FOUND"
  | "GITHUB_UPSTREAM_ERROR"
  | "GITHUB_BAD_PAYLOAD"
  | "GITHUB_TIMEOUT"
  | "GITHUB_NETWORK_ERROR";

const GITHUB_TIMEOUT_MS = 8000;
const OWNER_PATTERN = /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 100;
const MAX_PER_PAGE = 100;

function errorResponse(status: number, code: ApiErrorCode, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

function isValidOwner(owner: string): boolean {
  return OWNER_PATTERN.test(owner);
}

function isValidRepo(repo: string): boolean {
  return REPO_PATTERN.test(repo);
}

function parsePageParam(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function hasNextPage(headers: Headers): boolean {
  const linkHeader = headers.get("link");
  if (!linkHeader) return false;
  return linkHeader.split(",").some((part) => part.includes('rel="next"'));
}

function githubErrorResponse(status: number, headers: Headers) {
  if (status === 401) {
    return errorResponse(401, "GITHUB_TOKEN_INVALID", "GitHub token is invalid or expired. Please login again.");
  }

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

  if (status === 404) {
    return errorResponse(404, "GITHUB_NOT_FOUND", "Repository not found or no access");
  }

  return errorResponse(502, "GITHUB_UPSTREAM_ERROR", "Failed to load branches from GitHub");
}

export async function GET(req: NextRequest) {
  const accessToken = await getGitHubAccessToken(req);
  if (!accessToken) {
    return errorResponse(401, "UNAUTHORIZED", "Unauthorized");
  }

  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");

  if (!owner || !repo) {
    return errorResponse(400, "INVALID_QUERY", "Missing required query params: owner, repo");
  }

  if (!isValidOwner(owner) || !isValidRepo(repo)) {
    return errorResponse(400, "INVALID_QUERY", "Invalid owner or repo format.");
  }

  const page = parsePageParam(req.nextUrl.searchParams.get("page"), DEFAULT_PAGE, 1000);
  const perPage = parsePageParam(req.nextUrl.searchParams.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE);

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      return githubErrorResponse(res.status, res.headers);
    }

    const payload = (await res.json()) as unknown;
    if (!Array.isArray(payload)) {
      return errorResponse(502, "GITHUB_BAD_PAYLOAD", "GitHub returned an unexpected branch payload.");
    }

    const branches = payload as GitHubBranch[];
    return NextResponse.json(
      {
        branches: branches.map((branch) => ({
          name: branch.name,
          protected: branch.protected,
        })),
        page,
        perPage,
        hasNextPage: hasNextPage(res.headers),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(504, "GITHUB_TIMEOUT", "GitHub request timed out. Please retry.");
    }
    return errorResponse(502, "GITHUB_NETWORK_ERROR", "GitHub is temporarily unavailable. Please retry.");
  } finally {
    clearTimeout(timeoutId);
  }
}
