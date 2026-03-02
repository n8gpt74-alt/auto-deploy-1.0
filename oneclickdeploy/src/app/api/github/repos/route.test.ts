import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getGitHubAccessToken } from "@/lib/github-token";

vi.mock("@/lib/github-token", () => ({
  getGitHubAccessToken: vi.fn(),
}));

describe("GET /api/github/repos", () => {
  const tokenMock = vi.mocked(getGitHubAccessToken);
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 401 when request is unauthorized", async () => {
    tokenMock.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/github/repos");
    const res = await GET(req);
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("maps GitHub rate limit response to 429", async () => {
    tokenMock.mockResolvedValueOnce("token");
    fetchMock.mockResolvedValueOnce(
      new Response("{}", {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1700000000",
        },
      }),
    );

    const req = new NextRequest("http://localhost/api/github/repos?page=1&perPage=30");
    const res = await GET(req);
    const body = (await res.json()) as { code: string; resetAt: number };

    expect(res.status).toBe(429);
    expect(body.code).toBe("GITHUB_RATE_LIMITED");
    expect(body.resetAt).toBe(1700000000 * 1000);
  });

  it("returns normalized repos payload on success", async () => {
    tokenMock.mockResolvedValueOnce("token");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: "web",
            full_name: "acme/web",
            html_url: "https://github.com/acme/web",
            default_branch: "main",
            private: false,
            updated_at: "2026-03-01T00:00:00Z",
            owner: { login: "acme" },
          },
        ]),
        {
          status: 200,
          headers: {
            link: '<https://api.github.com/user/repos?page=2>; rel="next"',
          },
        },
      ),
    );

    const req = new NextRequest("http://localhost/api/github/repos?page=1&perPage=30");
    const res = await GET(req);
    const body = (await res.json()) as { repos: Array<{ fullName: string }>; hasNextPage: boolean };

    expect(res.status).toBe(200);
    expect(body.hasNextPage).toBe(true);
    expect(body.repos[0]?.fullName).toBe("acme/web");
  });
});
