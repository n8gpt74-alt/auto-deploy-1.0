import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type GitHubBranch = {
  name: string;
  protected: boolean;
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
    return NextResponse.json({ error: "No access to this repository" }, { status: 403 });
  }

  if (status === 404) {
    return NextResponse.json({ error: "Repository not found or no access" }, { status: 404 });
  }

  return NextResponse.json({ error: "Failed to load branches from GitHub" }, { status: 502 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing required query params: owner, repo" }, { status: 400 });
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`;
  const res = await fetch(url, {
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

  const branches = (await res.json()) as GitHubBranch[];
  return NextResponse.json({
    branches: branches.map((branch) => ({
      name: branch.name,
      protected: branch.protected,
    })),
  });
}
