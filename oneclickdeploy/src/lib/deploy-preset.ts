export type DeployPresetFields = {
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  envText: string;
};

export type DeployPresetItem = DeployPresetFields & {
  id: string;
  name: string;
  updatedAt: string;
};

type DeployPresetV1 = {
  version: 1;
  rootDirectory: string;
  buildCommand: string;
  outputDirectory: string;
  envText: string;
};

type DeployPresetV2 = {
  version: 2;
  items: Array<{
    id: string;
    name: string;
    rootDirectory: string;
    buildCommand: string;
    outputDirectory: string;
    envText: string;
    updatedAt: string;
  }>;
};

export const DEPLOY_PRESET_STORAGE_KEY = "deploy-buttons:preset:v1";

const DEPLOY_PRESET_STORAGE_KEY_V2 = "deploy-buttons:presets:v2";

const MAX_PRESET_NAME_LENGTH = 60;
const DEFAULT_MIGRATED_PRESET_NAME = "Imported preset";

type SavePresetResult = { ok: true } | { ok: false; error: string };
type LoadPresetResult =
  | { ok: true; preset: DeployPresetFields | null }
  | { ok: false; error: string };
type ClearPresetResult = { ok: true } | { ok: false; error: string };
type SavePresetItemResult = { ok: true; item: DeployPresetItem } | { ok: false; error: string };
type LoadPresetItemsResult =
  | { ok: true; items: DeployPresetItem[] }
  | { ok: false; error: string };
type DeletePresetItemResult = { ok: true } | { ok: false; error: string };

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

function normalizePresetName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, MAX_PRESET_NAME_LENGTH);
}

function isPresetV2(value: unknown): value is DeployPresetV2 {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DeployPresetV2>;
  if (candidate.version !== 2 || !Array.isArray(candidate.items)) {
    return false;
  }

  return candidate.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const preset = item as Partial<DeployPresetItem>;
    return (
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      typeof preset.rootDirectory === "string" &&
      typeof preset.buildCommand === "string" &&
      typeof preset.outputDirectory === "string" &&
      typeof preset.envText === "string" &&
      typeof preset.updatedAt === "string"
    );
  });
}

function toPresetFields(item: DeployPresetItem): DeployPresetFields {
  return {
    rootDirectory: item.rootDirectory,
    buildCommand: item.buildCommand,
    outputDirectory: item.outputDirectory,
    envText: item.envText,
  };
}

function toPresetV2(items: DeployPresetItem[]): DeployPresetV2 {
  return {
    version: 2,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      rootDirectory: item.rootDirectory,
      buildCommand: item.buildCommand,
      outputDirectory: item.outputDirectory,
      envText: item.envText,
      updatedAt: item.updatedAt,
    })),
  };
}

function parsePresetItems(storage: Storage): LoadPresetItemsResult {
  const raw = storage.getItem(DEPLOY_PRESET_STORAGE_KEY_V2);
  if (!raw) {
    return { ok: true, items: [] };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPresetV2(parsed)) {
      return { ok: false, error: "Stored preset templates format is invalid." };
    }

    const items = parsed.items.map((item) => ({
      id: item.id,
      name: item.name,
      rootDirectory: item.rootDirectory,
      buildCommand: item.buildCommand,
      outputDirectory: item.outputDirectory,
      envText: item.envText,
      updatedAt: item.updatedAt,
    }));

    return { ok: true, items };
  } catch {
    return { ok: false, error: "Stored preset templates are corrupted and cannot be loaded." };
  }
}

function writePresetItems(storage: Storage, items: DeployPresetItem[]): SavePresetResult {
  try {
    storage.setItem(DEPLOY_PRESET_STORAGE_KEY_V2, JSON.stringify(toPresetV2(items)));
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to save preset templates to local storage." };
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function migratePresetStorageToV2(): SavePresetResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const existingV2 = parsePresetItems(storage);
  if (!existingV2.ok) {
    return existingV2;
  }

  if (existingV2.items.length > 0) {
    return { ok: true };
  }

  const rawLegacy = storage.getItem(DEPLOY_PRESET_STORAGE_KEY);
  if (!rawLegacy) {
    return { ok: true };
  }

  try {
    const parsedLegacy = JSON.parse(rawLegacy) as unknown;
    if (!isPresetV1(parsedLegacy)) {
      return { ok: true };
    }

    const migrated: DeployPresetItem = {
      id: createId(),
      name: DEFAULT_MIGRATED_PRESET_NAME,
      rootDirectory: parsedLegacy.rootDirectory,
      buildCommand: parsedLegacy.buildCommand,
      outputDirectory: parsedLegacy.outputDirectory,
      envText: parsedLegacy.envText,
      updatedAt: nowIso(),
    };

    const writeResult = writePresetItems(storage, [migrated]);
    if (!writeResult.ok) {
      return writeResult;
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export function saveNamedDeployPreset(name: string, fields: DeployPresetFields): SavePresetItemResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const normalizedName = normalizePresetName(name);
  if (!normalizedName) {
    return { ok: false, error: "Preset name is required." };
  }

  const migrateResult = migratePresetStorageToV2();
  if (!migrateResult.ok) {
    return migrateResult;
  }

  const parsed = parsePresetItems(storage);
  if (!parsed.ok) {
    return parsed;
  }

  const item: DeployPresetItem = {
    id: createId(),
    name: normalizedName,
    rootDirectory: fields.rootDirectory,
    buildCommand: fields.buildCommand,
    outputDirectory: fields.outputDirectory,
    envText: fields.envText,
    updatedAt: nowIso(),
  };

  const items = [item, ...parsed.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const writeResult = writePresetItems(storage, items);
  if (!writeResult.ok) {
    return writeResult;
  }

  return { ok: true, item };
}

export function loadDeployPresetItems(): LoadPresetItemsResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const migrateResult = migratePresetStorageToV2();
  if (!migrateResult.ok) {
    return migrateResult;
  }

  const parsed = parsePresetItems(storage);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    items: parsed.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export function deleteDeployPresetItem(id: string): DeletePresetItemResult {
  const storage = readStorage();
  if (!storage) {
    return { ok: false, error: "Local storage is not available in this environment." };
  }

  const parsed = parsePresetItems(storage);
  if (!parsed.ok) {
    return parsed;
  }

  const nextItems = parsed.items.filter((item) => item.id !== id);
  const writeResult = writePresetItems(storage, nextItems);
  if (!writeResult.ok) {
    return writeResult;
  }

  return { ok: true };
}

export function loadDeployPresetById(id: string): LoadPresetResult {
  const itemsResult = loadDeployPresetItems();
  if (!itemsResult.ok) {
    return itemsResult;
  }

  const item = itemsResult.items.find((preset) => preset.id === id);
  if (!item) {
    return { ok: true, preset: null };
  }

  return { ok: true, preset: toPresetFields(item) };
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
  const itemsResult = loadDeployPresetItems();
  if (itemsResult.ok && itemsResult.items.length > 0) {
    return { ok: true, preset: toPresetFields(itemsResult.items[0]) };
  }

  if (!itemsResult.ok) {
    return itemsResult;
  }

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
    storage.removeItem(DEPLOY_PRESET_STORAGE_KEY_V2);
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to remove preset from local storage." };
  }
}
