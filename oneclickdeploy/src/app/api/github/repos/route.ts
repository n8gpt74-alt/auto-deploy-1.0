import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
  owner: {
    login: string;
  };
};

function githubErrorResponse(status: number, headers: Headers) {
  if (status === 401) {
    return NextResponse.json({ error: "GitHub token is invalid or expired. Please login again." }, { status: 401 });
  }

  if (status === 403) {
    const remaining = headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = headers.get("x-ratelimit-reset");
      return NextResponse.json(
        { error: "GitHub API rate limit exceeded", resetAt: reset ? Number(reset) * 1000 : null },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Access denied by GitHub API" }, { status: 403 });
  }

  return NextResponse.json({ error: "Failed to load repositories from GitHub" }, { status: 502 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return githubErrorResponse(res.status, res.headers);
  }

  const repos = (await res.json()) as GitHubRepo[];

  const normalized = repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
    private: repo.private,
    updatedAt: repo.updated_at,
  }));

  return NextResponse.json({ repos: normalized });
}
