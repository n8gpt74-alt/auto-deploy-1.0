export type RepoSelection = {
  owner: string;
  name: string;
  htmlUrl: string;
  branch: string;
};

export type BuildConfigInput = {
  rootDirectory?: string;
  buildCommand?: string;
  outputDirectory?: string;
  envText?: string;
};

export type ParsedEnvVar = {
  key: string;
  value: string;
};

function clean(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseEnvText(envText?: string): ParsedEnvVar[] {
  if (!envText) return [];

  return envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) return null;

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) return null;
      return { key, value };
    })
    .filter((item): item is ParsedEnvVar => Boolean(item));
}

export function createVercelDeployUrl(repo: RepoSelection, config: BuildConfigInput): string {
  const params = new URLSearchParams({
    "repository-url": repo.htmlUrl,
    "project-name": repo.name,
    "repository-name": repo.name,
  });

  const rootDirectory = clean(config.rootDirectory);
  const buildCommand = clean(config.buildCommand);
  const outputDirectory = clean(config.outputDirectory);

  if (rootDirectory) params.set("root-directory", rootDirectory);
  if (buildCommand) params.set("build-command", buildCommand);
  if (outputDirectory) params.set("output-directory", outputDirectory);

  const envVars = parseEnvText(config.envText);
  if (envVars.length > 0) {
    // Vercel Deploy Button reliably accepts env key names in query parameter `env`.
    // Environment values are not passed here.
    params.set("env", envVars.map((item) => item.key).join(","));
  }

  // Branch parameter is intentionally not included:
  // `vercel.com/new/clone` has no stable documented branch query parameter.
  return `https://vercel.com/new/clone?${params.toString()}`;
}

export function createNetlifyDeployUrl(repo: RepoSelection, config: BuildConfigInput): string {
  const params = new URLSearchParams({ repository: repo.htmlUrl });

  const branch = clean(repo.branch);
  const rootDirectory = clean(config.rootDirectory);

  if (branch) params.set("branch", branch);
  if (rootDirectory) params.set("base", rootDirectory);

  // Netlify Deploy Button does not support build/output command overrides as query params.
  const url = `https://app.netlify.com/start/deploy?${params.toString()}`;

  const envVars = parseEnvText(config.envText);
  if (envVars.length === 0) return url;

  const hashParams = new URLSearchParams();
  for (const envVar of envVars) {
    hashParams.set(envVar.key, envVar.value);
  }

  return `${url}#${hashParams.toString()}`;
}

export function createCloudflareDeployUrl(repo: RepoSelection): string {
  // Cloudflare Deploy Button supports Workers templates via repo URL.
  // Official format: https://deploy.workers.cloudflare.com/?url=<GIT_REPO_URL>
  const params = new URLSearchParams({ url: repo.htmlUrl });
  return `https://deploy.workers.cloudflare.com/?${params.toString()}`;
}
