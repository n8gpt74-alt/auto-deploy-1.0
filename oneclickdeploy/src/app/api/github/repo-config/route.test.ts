import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { getGitHubAccessToken } from "@/lib/github-token";

vi.mock("@/lib/github-token", () => ({
  getGitHubAccessToken: vi.fn(),
}));

describe("GET /api/github/repo-config", () => {
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

    const req = new NextRequest("http://localhost/api/github/repo-config?owner=acme&repo=web");
    const res = await GET(req);
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns recommendations based on package.json", async () => {
    tokenMock.mockResolvedValueOnce("token");

    const packageJson = Buffer.from(
      JSON.stringify({
        scripts: { build: "next build" },
        dependencies: { next: "16.1.6" },
      }),
      "utf8",
    ).toString("base64");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "file",
          encoding: "base64",
          content: packageJson,
        }),
        { status: 200 },
      ),
    );
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));

    const req = new NextRequest("http://localhost/api/github/repo-config?owner=acme&repo=web");
    const res = await GET(req);
    const body = (await res.json()) as {
      framework: string;
      recommendation: { buildCommand: string; outputDirectory: string };
      detectedFiles: { packageJson: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.framework).toBe("nextjs");
    expect(body.recommendation.buildCommand).toBe("next build");
    expect(body.recommendation.outputDirectory).toBe(".next");
    expect(body.detectedFiles.packageJson).toBe(true);
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

    const req = new NextRequest("http://localhost/api/github/repo-config?owner=acme&repo=web");
    const res = await GET(req);
    const body = (await res.json()) as { code: string; resetAt: number };

    expect(res.status).toBe(429);
    expect(body.code).toBe("GITHUB_RATE_LIMITED");
    expect(body.resetAt).toBe(1700000000 * 1000);
  });
});
