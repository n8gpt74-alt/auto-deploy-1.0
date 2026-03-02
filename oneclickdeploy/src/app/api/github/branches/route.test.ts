import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getGitHubAccessToken } from "@/lib/github-token";

vi.mock("@/lib/github-token", () => ({
  getGitHubAccessToken: vi.fn(),
}));

describe("GET /api/github/branches", () => {
  const tokenMock = vi.mocked(getGitHubAccessToken);
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 400 for invalid owner format", async () => {
    tokenMock.mockResolvedValueOnce("token");

    const req = new NextRequest("http://localhost/api/github/branches?owner=bad/owner&repo=web");
    const res = await GET(req);
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(400);
    expect(body.code).toBe("INVALID_QUERY");
  });

  it("maps GitHub not found to 404", async () => {
    tokenMock.mockResolvedValueOnce("token");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));

    const req = new NextRequest("http://localhost/api/github/branches?owner=acme&repo=missing");
    const res = await GET(req);
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("GITHUB_NOT_FOUND");
  });

  it("returns normalized branch payload on success", async () => {
    tokenMock.mockResolvedValueOnce("token");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { name: "main", protected: true },
          { name: "develop", protected: false },
        ]),
        {
          status: 200,
          headers: {
            link: '<https://api.github.com/repos/acme/web/branches?page=2>; rel="next"',
          },
        },
      ),
    );

    const req = new NextRequest("http://localhost/api/github/branches?owner=acme&repo=web&page=1&perPage=100");
    const res = await GET(req);
    const body = (await res.json()) as { branches: Array<{ name: string }>; hasNextPage: boolean };

    expect(res.status).toBe(200);
    expect(body.hasNextPage).toBe(true);
    expect(body.branches.map((branch) => branch.name)).toEqual(["main", "develop"]);
  });
});
