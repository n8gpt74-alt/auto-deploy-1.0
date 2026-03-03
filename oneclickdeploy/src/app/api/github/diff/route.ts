import { NextRequest, NextResponse } from "next/server";
import { getGitHubAccessToken } from "@/lib/github-token";

export async function GET(req: NextRequest) {
  const accessToken = await getGitHubAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const base = searchParams.get("base");
  const head = searchParams.get("head");

  if (!owner || !repo || !base || !head) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "GITHUB_API_ERROR" }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json({
      status: json.status,
      aheadBy: json.ahead_by,
      behindBy: json.behind_by,
      totalCommits: json.total_commits,
      files: json.files.map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
