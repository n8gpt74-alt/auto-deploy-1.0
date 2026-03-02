export type DeployPresetFields = {
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  envText: string;
};

type DeployPresetV1 = {
  version: 1;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  envText: string;
};

export const DEPLOY_PRESET_STORAGE_KEY = "deploy-buttons:preset:v1";

type SavePresetResult = { ok: true } | { ok: false; error: string };
type LoadPresetResult =
  | { ok: true; preset: DeployPresetFields | null }
  | { ok: false; error: string };
type ClearPresetResult = { ok: true } | { ok: false; error: string };

function toPresetV1(fields: DeployPresetFields): DeployPresetV1 {
  return {
    version: 1,
    rootDirectory: fields.rootDirectory,
    buildCommand: fields.buildCommand,
    outputDirectory: fields.outputDirectory,
    envText: fields.envText,
  };
}

function isPresetV1(value: unknown): value is DeployPresetV1 {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DeployPresetV1>;
  return (
    candidate.version === 1 &&
    typeof candidate.rootDirectory === "string" &&
    typeof candidate.buildCommand === "string" &&
    typeof candidate.outputDirectory === "string" &&
    typeof candidate.envText === "string"
  );
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function saveDeployPreset(fields: DeployPresetFields): SavePresetResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  try {
    storage.setItem(DEPLOY_PRESET_STORAGE_KEY, JSON.stringify(toPresetV1(fields)));
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save preset to local storage." };
  }
}

export function loadDeployPreset(): LoadPresetResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const raw = storage.getItem(DEPLOY_PRESET_STORAGE_KEY);
  if (!raw) {
    return { ok: true, preset: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPresetV1(parsed)) {
      return { ok: false, error: "Stored preset format is invalid." };
    }

    return {
      ok: true,
      preset: {
        rootDirectory: parsed.rootDirectory,
        buildCommand: parsed.buildCommand,
        outputDirectory: parsed.outputDirectory,
        envText: parsed.envText,
      },
    };
  } catch {
    return { ok: false, error: "Stored preset is corrupted and cannot be loaded." };
  }
}

export function clearDeployPreset(): ClearPresetResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  try {
    storage.removeItem(DEPLOY_PRESET_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to remove preset from local storage." };
  }
}
