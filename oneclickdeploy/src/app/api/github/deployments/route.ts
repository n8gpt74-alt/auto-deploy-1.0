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

type GitHubDeployment = {
  id: number;
  environment: string;
  created_at: string;
  updated_at: string;
  statuses_url: string;
  creator: {
    login: string;
    avatar_url: string;
  } | null;
  description: string | null;
  ref: string;
};

type GitHubDeploymentStatus = {
  id: number;
  state: string;
  description: string | null;
  created_at: string;
  target_url: string | null;
  environment_url: string | null;
  log_url: string | null;
};

type NormalizedDeployment = {
  id: number;
  environment: string;
  state: string;
  description: string | null;
  ref: string;
  createdAt: string;
  updatedAt: string;
  creator: string | null;
  targetUrl: string | null;
  environmentUrl: string | null;
  logUrl: string | null;
};

const GITHUB_TIMEOUT_MS = 10000;
const MAX_DEPLOYMENTS = 5;
const OWNER_PATTERN = /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function errorResponse(status: number, code: ApiErrorCode, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ code, error, ...extra }, { status });
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
  return errorResponse(502, "GITHUB_UPSTREAM_ERROR", "Failed to fetch deployment data from GitHub");
}

function mapState(ghState: string): string {
  switch (ghState) {
    case "pending":
    case "queued":
    case "in_progress":
      return "building";
    case "success":
      return "ready";
    case "failure":
    case "error":
      return "error";
    case "inactive":
      return "inactive";
    default:
      return ghState;
  }
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

  if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo)) {
    return errorResponse(400, "INVALID_QUERY", "Invalid owner or repo format.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const deploymentsRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/deployments?per_page=${MAX_DEPLOYMENTS}`,
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

    if (!deploymentsRes.ok) {
      return githubErrorResponse(deploymentsRes.status, deploymentsRes.headers);
    }

    const deployments = (await deploymentsRes.json()) as GitHubDeployment[];

    if (!Array.isArray(deployments) || deployments.length === 0) {
      return NextResponse.json({ deployments: [] }, { headers: { "Cache-Control": "private, no-cache" } });
    }

    // Fetch latest status for each deployment in parallel
    const statusPromises = deployments.map(async (deployment): Promise<NormalizedDeployment> => {
      try {
        const statusRes = await fetch(deployment.statuses_url + "?per_page=1", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!statusRes.ok) {
          return {
            id: deployment.id,
            environment: deployment.environment,
            state: "pending",
            description: deployment.description,
            ref: deployment.ref,
            createdAt: deployment.created_at,
            updatedAt: deployment.updated_at,
            creator: deployment.creator?.login ?? null,
            targetUrl: null,
            environmentUrl: null,
            logUrl: null,
          };
        }

        const statuses = (await statusRes.json()) as GitHubDeploymentStatus[];
        const latest = Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : null;

        return {
          id: deployment.id,
          environment: deployment.environment,
          state: latest ? mapState(latest.state) : "pending",
          description: latest?.description ?? deployment.description,
          ref: deployment.ref,
          createdAt: deployment.created_at,
          updatedAt: latest?.created_at ?? deployment.updated_at,
          creator: deployment.creator?.login ?? null,
          targetUrl: latest?.target_url ?? null,
          environmentUrl: latest?.environment_url ?? null,
          logUrl: latest?.log_url ?? null,
        };
      } catch {
        return {
          id: deployment.id,
          environment: deployment.environment,
          state: "pending",
          description: deployment.description,
          ref: deployment.ref,
          createdAt: deployment.created_at,
          updatedAt: deployment.updated_at,
          creator: deployment.creator?.login ?? null,
          targetUrl: null,
          environmentUrl: null,
          logUrl: null,
        };
      }
    });

    const normalized = await Promise.all(statusPromises);

    return NextResponse.json(
      { deployments: normalized },
      { headers: { "Cache-Control": "private, no-cache" } },
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
