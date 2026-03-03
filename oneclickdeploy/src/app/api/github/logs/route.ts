import { NextRequest, NextResponse } from "next/server";
import { getGitHubAccessToken } from "@/lib/github-token";

export async function GET(req: NextRequest) {
  const token = await getGitHubAccessToken(req);
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const deploymentId = searchParams.get("deploymentId");

  if (!owner || !repo || !deploymentId) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/deployments/${deploymentId}/statuses`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) {
        if (res.status === 404) {
            return NextResponse.json({ logLines: ["[ERROR] Deployment not found or no status yet."] });
        }
      return NextResponse.json({ error: "GITHUB_API_ERROR" }, { status: res.status });
    }

    const statuses = await res.json();
    
    const logLines = (statuses as any[]).map((s: any) => {
      const date = new Date(s.created_at).toLocaleTimeString();
      const state = s.state.toUpperCase();
      let color = "text-gray-400";
      if (state === "SUCCESS" || state === "ACTIVE") color = "text-green-500";
      if (state === "FAILURE" || state === "ERROR") color = "text-red-500";
      if (state === "PENDING" || state === "IN_PROGRESS") color = "text-yellow-500";

      return `<span class="${color}">[${date}] ${state}: ${s.description || "Обновление статуса"}</span>`;
    }).reverse();

    // Add a couple of initial "boot" lines if it's the first fetch
    const finalLogs = [
        `<span class="text-blue-500">[SYSTEM] Соединение с GitHub API установлено...</span>`,
        `<span class="text-blue-500">[SYSTEM] Получение истории событий для Deployment #${deploymentId}...</span>`,
        ...logLines
    ];

    return NextResponse.json({ logLines: finalLogs });
  } catch (err) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
