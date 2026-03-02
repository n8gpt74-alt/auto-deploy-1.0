import { describe, expect, it } from "vitest";
import { createCloudflareDeployUrl, createNetlifyDeployUrl, createVercelDeployUrl, parseEnvText } from "./deploy-links";

describe("parseEnvText", () => {
  it("parses valid KEY=VALUE lines and ignores invalid lines", () => {
    const parsed = parseEnvText("API_URL=https://api.example.com\nBROKEN\n NODE_ENV = production ");

    expect(parsed).toEqual([
      { key: "API_URL", value: "https://api.example.com" },
      { key: "NODE_ENV", value: "production" },
    ]);
  });
});

describe("createVercelDeployUrl", () => {
  it("builds a vercel clone URL with supported optional params", () => {
    const url = createVercelDeployUrl(
      {
        owner: "acme",
        name: "web",
        htmlUrl: "https://github.com/acme/web",
        branch: "main",
      },
      {
        rootDirectory: "apps/web",
        buildCommand: "npm run build",
        outputDirectory: ".next",
        envText: "API_URL=https://api.example.com\nNODE_ENV=production",
      },
    );

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://vercel.com");
    expect(parsed.pathname).toBe("/new/clone");
    expect(parsed.searchParams.get("repository-url")).toBe("https://github.com/acme/web");
    expect(parsed.searchParams.get("project-name")).toBe("web");
    expect(parsed.searchParams.get("root-directory")).toBe("apps/web");
    expect(parsed.searchParams.get("build-command")).toBe("npm run build");
    expect(parsed.searchParams.get("output-directory")).toBe(".next");
    expect(parsed.searchParams.get("env")).toBe("API_URL,NODE_ENV");
    expect(parsed.searchParams.get("branch")).toBeNull();
  });
});

describe("createNetlifyDeployUrl", () => {
  it("builds a netlify deploy URL with branch/base and env hash", () => {
    const url = createNetlifyDeployUrl(
      {
        owner: "acme",
        name: "web",
        htmlUrl: "https://github.com/acme/web",
        branch: "feature/preset",
      },
      {
        rootDirectory: "apps/web",
        envText: "API_URL=https://api.example.com\nNODE_ENV=production",
      },
    );

    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.slice(1));

    expect(parsed.origin).toBe("https://app.netlify.com");
    expect(parsed.pathname).toBe("/start/deploy");
    expect(parsed.searchParams.get("repository")).toBe("https://github.com/acme/web");
    expect(parsed.searchParams.get("branch")).toBe("feature/preset");
    expect(parsed.searchParams.get("base")).toBe("apps/web");
    expect(hash.get("API_URL")).toBe("https://api.example.com");
    expect(hash.get("NODE_ENV")).toBe("production");
  });
});

describe("createCloudflareDeployUrl", () => {
  it("builds a cloudflare deploy URL with repository url", () => {
    const url = createCloudflareDeployUrl({
      owner: "acme",
      name: "web",
      htmlUrl: "https://github.com/acme/web",
      branch: "main",
    });

    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://deploy.workers.cloudflare.com");
    expect(parsed.pathname).toBe("/");
    expect(parsed.searchParams.get("url")).toBe("https://github.com/acme/web");
  });
});
