import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDeployHistory, loadDeployHistory, recordDeployHistory } from "./deploy-history";

describe("deploy-history", () => {
  beforeEach(() => {
    const storage = (() => {
      const data = new Map<string, string>();
      return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
        clear: () => data.clear(),
        key: (index: number) => Array.from(data.keys())[index] ?? null,
        get length() {
          return data.size;
        },
      } as Storage;
    })();

    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records deploy history and strips netlify env hash", () => {
    const result = recordDeployHistory({
      provider: "netlify",
      repoFullName: "acme/web",
      repoUrl: "https://github.com/acme/web",
      branch: "main",
      config: {
        rootDirectory: "apps/web",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        envText: "API_URL=https://api.example.com\nNODE_ENV=production",
      },
      deployUrl: "https://app.netlify.com/start/deploy?repository=https://github.com/acme/web#API_URL=https://api.example.com",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.item.envKeys).toEqual(["API_URL", "NODE_ENV"]);
    expect(result.item.deployUrl).toBe("https://app.netlify.com/start/deploy?repository=https://github.com/acme/web");
  });

  it("loads items in reverse chronological order", () => {
    recordDeployHistory({
      provider: "vercel",
      repoFullName: "acme/one",
      repoUrl: "https://github.com/acme/one",
      branch: "main",
      config: {},
      deployUrl: "https://vercel.com/new/clone?repository-url=https://github.com/acme/one",
    });

    recordDeployHistory({
      provider: "cloudflare",
      repoFullName: "acme/two",
      repoUrl: "https://github.com/acme/two",
      branch: "develop",
      config: {},
      deployUrl: "https://deploy.workers.cloudflare.com/?url=https://github.com/acme/two",
    });

    const loaded = loadDeployHistory();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.items).toHaveLength(2);
    expect(loaded.items[0]?.repoFullName).toBe("acme/two");
    expect(loaded.items[1]?.repoFullName).toBe("acme/one");
  });

  it("clears history", () => {
    recordDeployHistory({
      provider: "vercel",
      repoFullName: "acme/one",
      repoUrl: "https://github.com/acme/one",
      branch: "main",
      config: {},
      deployUrl: "https://vercel.com/new/clone?repository-url=https://github.com/acme/one",
    });

    expect(clearDeployHistory()).toEqual({ ok: true });

    const loaded = loadDeployHistory();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.items).toEqual([]);
  });
});
