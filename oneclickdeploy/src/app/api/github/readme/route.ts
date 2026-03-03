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

  if (!owner || !repo) {
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3.raw",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
        if (res.status === 404) {
             return NextResponse.json({ content: "No README.md found for this project." });
        }
      return NextResponse.json({ error: "GITHUB_API_ERROR" }, { status: res.status });
    }

    const content = await res.text();
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
