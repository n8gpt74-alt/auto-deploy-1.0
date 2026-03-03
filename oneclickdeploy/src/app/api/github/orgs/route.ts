import { NextRequest, NextResponse } from "next/server";
import { getGitHubAccessToken } from "@/lib/github-token";

export async function GET(req: NextRequest) {
  const accessToken = await getGitHubAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.github.com/user/orgs", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "GITHUB_API_ERROR" }, { status: res.status });
    }

    const orgs = await res.json();
    const normalized = orgs.map((org: any) => ({
      id: org.id,
      login: org.login,
      avatarUrl: org.avatar_url,
      description: org.description,
    }));

    return NextResponse.json({ orgs: normalized });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
