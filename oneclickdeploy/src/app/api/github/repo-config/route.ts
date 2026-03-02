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

type RepoFileResponse = {
  content?: string;
  encoding?: string;
  type?: string;
};

type SuggestedConfig = {
  framework: string;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  notes: string[];
};

const GITHUB_TIMEOUT_MS = 8000;
const OWNER_PATTERN = /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function errorResponse(status: number, code: ApiErrorCode, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

function isValidOwner(owner: string): boolean {
  return OWNER_PATTERN.test(owner);
}

function isValidRepo(repo: string): boolean {
  return REPO_PATTERN.test(repo);
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

  return errorResponse(502, "GITHUB_UPSTREAM_ERROR", "Failed to inspect repository configuration from GitHub");
}

function decodeGitHubContent(payload: RepoFileResponse): string | null {
  if (payload.type !== "file" || typeof payload.content !== "string") {
    return null;
  }

  if (payload.encoding === "base64") {
    try {
      return Buffer.from(payload.content, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  return payload.content;
}

function createDefaultSuggestion(): SuggestedConfig {
  return {
    framework: "generic-node",
    rootDirectory: ".",
    buildCommand: "npm run build",
    outputDirectory: "",
    notes: ["No framework-specific config detected. Using conservative defaults."],
  };
}

function detectFromPackageJson(text: string): SuggestedConfig {
  const suggestion = createDefaultSuggestion();

  try {
    const parsed = JSON.parse(text) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      workspaces?: unknown;
    };

    const dependencies = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    const scripts = parsed.scripts ?? {};

    const buildCommand = typeof scripts.build === "string" ? scripts.build : suggestion.buildCommand;
    suggestion.buildCommand = buildCommand;

    if (dependencies.next) {
      suggestion.framework = "nextjs";
      suggestion.outputDirectory = ".next";
      suggestion.notes.push("Detected Next.js from package.json dependencies.");
    } else if (dependencies.vite) {
      suggestion.framework = "vite";
      suggestion.outputDirectory = "dist";
      suggestion.notes.push("Detected Vite from package.json dependencies.");
    } else if (dependencies.astro) {
      suggestion.framework = "astro";
      suggestion.outputDirectory = "dist";
      suggestion.notes.push("Detected Astro from package.json dependencies.");
    } else if (dependencies["@opennextjs/cloudflare"] || dependencies.wrangler) {
      suggestion.framework = "cloudflare-worker";
      suggestion.outputDirectory = ".open-next/assets";
      suggestion.notes.push("Detected Cloudflare/OpenNext-related tooling in package.json.");
    }

    if (Array.isArray(parsed.workspaces) || parsed.workspaces) {
      suggestion.notes.push("Workspace configuration detected. Root directory may require manual adjustment.");
    }

    return suggestion;
  } catch {
    return {
      ...suggestion,
      notes: ["package.json exists but could not be parsed. Falling back to generic defaults."],
    };
  }
}

async function fetchRepoFile(owner: string, repo: string, path: string, accessToken: string, signal: AbortSignal): Promise<string | null> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
    signal,
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw { status: res.status, headers: res.headers };
  }

  const payload = (await res.json()) as RepoFileResponse;
  return decodeGitHubContent(payload);
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

  if (!isValidOwner(owner) || !isValidRepo(repo)) {
    return errorResponse(400, "INVALID_QUERY", "Invalid owner or repo format.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const [packageJson, vercelJson, netlifyToml, wranglerToml] = await Promise.all([
      fetchRepoFile(owner, repo, "package.json", accessToken, controller.signal),
      fetchRepoFile(owner, repo, "vercel.json", accessToken, controller.signal),
      fetchRepoFile(owner, repo, "netlify.toml", accessToken, controller.signal),
      fetchRepoFile(owner, repo, "wrangler.toml", accessToken, controller.signal),
    ]);

    const suggestion = packageJson ? detectFromPackageJson(packageJson) : createDefaultSuggestion();

    if (vercelJson) {
      suggestion.notes.push("vercel.json detected — Vercel project-specific settings likely exist.");
    }

    if (netlifyToml) {
      suggestion.notes.push("netlify.toml detected — Netlify build settings likely exist.");
    }

    if (wranglerToml) {
      suggestion.notes.push("wrangler.toml detected — Cloudflare Worker/Pages setup may require provider-specific review.");
    }

    return NextResponse.json(
      {
        framework: suggestion.framework,
        recommendation: {
          rootDirectory: suggestion.rootDirectory,
          buildCommand: suggestion.buildCommand,
          outputDirectory: suggestion.outputDirectory,
        },
        notes: suggestion.notes,
        detectedFiles: {
          packageJson: Boolean(packageJson),
          vercelJson: Boolean(vercelJson),
          netlifyToml: Boolean(netlifyToml),
          wranglerToml: Boolean(wranglerToml),
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(504, "GITHUB_TIMEOUT", "GitHub request timed out. Please retry.");
    }

    if (typeof error === "object" && error && "status" in error && "headers" in error) {
      const status = (error as { status: number }).status;
      const headers = (error as { headers: Headers }).headers;
      return githubErrorResponse(status, headers);
    }

    return errorResponse(502, "GITHUB_NETWORK_ERROR", "GitHub is temporarily unavailable. Please retry.");
  } finally {
    clearTimeout(timeoutId);
  }
}
