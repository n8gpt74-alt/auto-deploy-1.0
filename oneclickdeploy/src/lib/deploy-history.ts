import { parseEnvText, type BuildConfigInput } from "@/lib/deploy-links";

export type DeployProvider = "vercel" | "netlify" | "cloudflare" | "railway" | "render";

export type DeployHistoryEntry = {
  id: string;
  createdAt: string;
  provider: DeployProvider;
  repoFullName: string;
  repoUrl: string;
  branch: string;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  envKeys: string[];
  deployUrl: string;
};

type DeployHistoryV1 = {
  version: 1;
  items: DeployHistoryEntry[];
};

export const DEPLOY_HISTORY_STORAGE_KEY = "deploy-buttons:history:v1";

const MAX_HISTORY_ITEMS = 25;

type LoadHistoryResult =
  | { ok: true; items: DeployHistoryEntry[] }
  | { ok: false; error: string };
type RecordHistoryResult = { ok: true; item: DeployHistoryEntry } | { ok: false; error: string };
type ClearHistoryResult = { ok: true } | { ok: false; error: string };

type RecordDeployInput = {
  provider: DeployProvider;
  repoFullName: string;
  repoUrl: string;
  branch: string;
  config: BuildConfigInput;
  deployUrl: string;
};

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function isHistoryV1(value: unknown): value is DeployHistoryV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeployHistoryV1>;
  if (candidate.version !== 1 || !Array.isArray(candidate.items)) return false;

  return candidate.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Partial<DeployHistoryEntry>;
    return (
      typeof entry.id === "string" &&
      typeof entry.createdAt === "string" &&
      (entry.provider === "vercel" || entry.provider === "netlify" || entry.provider === "cloudflare" || entry.provider === "railway" || entry.provider === "render") &&
      typeof entry.repoFullName === "string" &&
      typeof entry.repoUrl === "string" &&
      typeof entry.branch === "string" &&
      typeof entry.rootDirectory === "string" &&
      typeof entry.buildCommand === "string" &&
      typeof entry.outputDirectory === "string" &&
      Array.isArray(entry.envKeys) &&
      entry.envKeys.every((envKey) => typeof envKey === "string") &&
      typeof entry.deployUrl === "string"
    );
  });
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeDeployUrl(provider: DeployProvider, deployUrl: string): string {
  if (provider !== "netlify") {
    return deployUrl;
  }

  try {
    const parsed = new URL(deployUrl);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return deployUrl.split("#")[0] ?? deployUrl;
  }
}

export function loadDeployHistory(): LoadHistoryResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const raw = storage.getItem(DEPLOY_HISTORY_STORAGE_KEY);
  if (!raw) {
    return { ok: true, items: [] };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isHistoryV1(parsed)) {
      return { ok: false, error: "Stored deploy history format is invalid." };
    }

    return {
      ok: true,
      items: [...parsed.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch {
    return { ok: false, error: "Stored deploy history is corrupted and cannot be loaded." };
  }
}

export function recordDeployHistory(input: RecordDeployInput): RecordHistoryResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const current = loadDeployHistory();
  if (!current.ok) {
    return current;
  }

  const envKeys = parseEnvText(input.config.envText).map((item) => item.key);

  const entry: DeployHistoryEntry = {
    id: createId(),
    createdAt: new Date().toISOString(),
    provider: input.provider,
    repoFullName: input.repoFullName,
    repoUrl: input.repoUrl,
    branch: input.branch,
    rootDirectory: input.config.rootDirectory?.trim() ?? "",
    buildCommand: input.config.buildCommand?.trim() ?? "",
    outputDirectory: input.config.outputDirectory?.trim() ?? "",
    envKeys,
    deployUrl: sanitizeDeployUrl(input.provider, input.deployUrl),
  };

  const payload: DeployHistoryV1 = {
    version: 1,
    items: [entry, ...current.items].slice(0, MAX_HISTORY_ITEMS),
  };

  try {
    storage.setItem(DEPLOY_HISTORY_STORAGE_KEY, JSON.stringify(payload));
    return { ok: true, item: entry };
  } catch {
    return { ok: false, error: "Failed to save deploy history to local storage." };
  }
}

export function clearDeployHistory(): ClearHistoryResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  try {
    storage.removeItem(DEPLOY_HISTORY_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to clear deploy history from local storage." };
  }
}
