"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createCloudflareDeployUrl, createNetlifyDeployUrl, createVercelDeployUrl } from "@/lib/deploy-links";
import { clearDeployPreset, loadDeployPreset, saveDeployPreset } from "@/lib/deploy-preset";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { IconBolt, IconBranch, IconCloud, IconGithub, IconLogout, IconRepo, IconRocket, IconSearch, IconSettings } from "@/components/ui/icons";

type RepoItem = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
};

type BranchItem = {
  name: string;
  protected: boolean;
};

type ApiError = {
  error?: string;
  resetAt?: number | null;
};

type ReposApiResponse = {
  repos?: RepoItem[];
  hasNextPage?: boolean;
};

type BranchesApiResponse = {
  branches?: BranchItem[];
  hasNextPage?: boolean;
};

type PresetNotice = {
  tone: "success" | "error";
  message: string;
};

const REPO_PAGE_SIZE = 30;
const BRANCH_PAGE_SIZE = 100;

function formatRateLimitError(error: ApiError): string {
  if (error.resetAt) {
    return `${error.error ?? "GitHub API rate limit exceeded"}. Retry after ${new Date(error.resetAt).toLocaleTimeString()}.`;
  }
  return error.error ?? "Request failed";
}

function buildStateBadge(tone: StatusTone, label: string) {
  return { tone, label } as const;
}

export function DeployDashboard() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const [rootDirectory, setRootDirectory] = useState("");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [envText, setEnvText] = useState("");

  const [reposLoading, setReposLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [presetNotice, setPresetNotice] = useState<PresetNotice | null>(null);
  const [repoPage, setRepoPage] = useState(1);
  const [reposHasNextPage, setReposHasNextPage] = useState(false);
  const [branchesPage, setBranchesPage] = useState(1);
  const [branchesHasNextPage, setBranchesHasNextPage] = useState(false);
  const [reposRefreshNonce, setReposRefreshNonce] = useState(0);

  useEffect(() => {
    async function loadRepos() {
      setReposLoading(true);
      setReposError(null);

      const params = new URLSearchParams({ page: String(repoPage), perPage: String(REPO_PAGE_SIZE) });
      const res = await fetch(`/api/github/repos?${params.toString()}`);
      const json = (await res.json()) as ReposApiResponse & ApiError;

      if (!res.ok) {
        setReposError(formatRateLimitError(json));
        if (repoPage === 1) {
          setRepos([]);
        }
        setReposHasNextPage(false);
        setReposLoading(false);
        return;
      }

      const nextRepos = json.repos ?? [];
      setReposHasNextPage(Boolean(json.hasNextPage));
      setRepos((current) => {
        if (repoPage === 1) {
          return nextRepos;
        }

        const seen = new Set(current.map((repo) => repo.id));
        const merged = [...current];
        for (const repo of nextRepos) {
          if (seen.has(repo.id)) continue;
          merged.push(repo);
        }
        return merged;
      });

      if (repoPage === 1 && nextRepos.length > 0) {
        const firstRepo = nextRepos[0];
        setBranches([]);
        setBranchesPage(1);
        setBranchesHasNextPage(false);
        setSelectedRepoId(String(firstRepo.id));
        setSelectedBranch(firstRepo.defaultBranch);
      } else if (repoPage === 1) {
        setSelectedRepoId("");
        setSelectedBranch("");
        setBranches([]);
        setBranchesPage(1);
        setBranchesHasNextPage(false);
      }

      setReposLoading(false);
    }

    loadRepos().catch(() => {
      setReposError("Failed to fetch repositories");
      setReposLoading(false);
    });
  }, [repoPage, reposRefreshNonce]);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((repo) => repo.fullName.toLowerCase().includes(q));
  }, [repos, search]);

  const selectedRepo = useMemo(
    () => repos.find((repo) => String(repo.id) === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  const selectedBranchItem = useMemo(
    () => branches.find((branch) => branch.name === selectedBranch) ?? null,
    [branches, selectedBranch],
  );

  useEffect(() => {
    if (!selectedRepo) {
      return;
    }

    const repo = selectedRepo;

    async function loadBranches() {
      setBranchesLoading(true);
      setBranchesError(null);

      const params = new URLSearchParams({
        owner: repo.owner,
        repo: repo.name,
        page: String(branchesPage),
        perPage: String(BRANCH_PAGE_SIZE),
      });
      const res = await fetch(`/api/github/branches?${params.toString()}`);
      const json = (await res.json()) as BranchesApiResponse & ApiError;

      if (!res.ok) {
        setBranchesError(formatRateLimitError(json));
        if (branchesPage === 1) {
          setBranches([]);
        }
        setBranchesHasNextPage(false);
        setBranchesLoading(false);
        return;
      }

      const nextBranches = json.branches ?? [];
      setBranchesHasNextPage(Boolean(json.hasNextPage));
      setBranches((current) => {
        if (branchesPage === 1) {
          return nextBranches;
        }

        const seen = new Set(current.map((branch) => branch.name));
        const merged = [...current];
        for (const branch of nextBranches) {
          if (seen.has(branch.name)) continue;
          merged.push(branch);
        }
        return merged;
      });

      if (branchesPage === 1) {
        const names = new Set(nextBranches.map((branch) => branch.name));
        setSelectedBranch((current) => {
          if (current && names.has(current)) return current;
          if (names.has(repo.defaultBranch)) return repo.defaultBranch;
          return nextBranches[0]?.name ?? "";
        });
      }

      setBranchesLoading(false);
    }

    loadBranches().catch(() => {
      setBranchesError("Failed to fetch branches");
      setBranchesLoading(false);
    });
  }, [selectedRepo, branchesPage]);

  const deployConfig = {
    rootDirectory,
    buildCommand,
    outputDirectory,
    envText,
  };

  function handleSavePreset() {
    const result = saveDeployPreset(deployConfig);
    if (!result.ok) {
      setPresetNotice({ tone: "error", message: result.error });
      return;
    }

    setPresetNotice({ tone: "success", message: "Preset saved locally." });
  }

  function handleLoadPreset() {
    const result = loadDeployPreset();
    if (!result.ok) {
      setPresetNotice({ tone: "error", message: result.error });
      return;
    }

    if (!result.preset) {
      setPresetNotice({ tone: "error", message: "No saved preset found." });
      return;
    }

    setRootDirectory(result.preset.rootDirectory);
    setBuildCommand(result.preset.buildCommand);
    setOutputDirectory(result.preset.outputDirectory);
    setEnvText(result.preset.envText);
    setPresetNotice({ tone: "success", message: "Preset loaded." });
  }

  function handleClearPreset() {
    const result = clearDeployPreset();
    if (!result.ok) {
      setPresetNotice({ tone: "error", message: result.error });
      return;
    }

    setPresetNotice({ tone: "success", message: "Saved preset removed." });
  }

  function handleRefreshRepositories() {
    setRepoPage(1);
    setRepos([]);
    setSelectedRepoId("");
    setSelectedBranch("");
    setBranches([]);
    setBranchesPage(1);
    setReposHasNextPage(false);
    setBranchesHasNextPage(false);
    setReposRefreshNonce((current) => current + 1);
  }

  const vercelUrl = selectedRepo
    ? createVercelDeployUrl(
        {
          owner: selectedRepo.owner,
          name: selectedRepo.name,
          htmlUrl: selectedRepo.htmlUrl,
          branch: selectedBranch,
        },
        deployConfig,
      )
    : "#";

  const netlifyUrl = selectedRepo
    ? createNetlifyDeployUrl(
        {
          owner: selectedRepo.owner,
          name: selectedRepo.name,
          htmlUrl: selectedRepo.htmlUrl,
          branch: selectedBranch,
        },
        deployConfig,
      )
    : "#";

  const cloudflareUrl = selectedRepo
    ? createCloudflareDeployUrl(
        {
          owner: selectedRepo.owner,
          name: selectedRepo.name,
          htmlUrl: selectedRepo.htmlUrl,
          branch: selectedBranch,
        },
      )
    : "#";

  const deployDisabled = !selectedRepo || !selectedBranch;

  const repoStateBadge =
    reposLoading
      ? buildStateBadge("loading", "Repositories: loading")
      : reposError
        ? buildStateBadge("error", "Repositories: failed")
        : repos.length === 0
          ? buildStateBadge("warning", "Repositories: empty")
          : buildStateBadge("success", `Repositories: ${repos.length}`);

  const branchStateBadge =
    !selectedRepo
      ? buildStateBadge("neutral", "Branch: not selected")
      : branchesLoading
        ? buildStateBadge("loading", "Branch: loading")
        : branchesError
          ? buildStateBadge("error", "Branch: failed")
          : branches.length === 0
            ? buildStateBadge("warning", "Branch: empty")
            : buildStateBadge("success", `Branches: ${branches.length}`);

  const selectedBranchBadge =
    !selectedBranchItem
      ? buildStateBadge("neutral", "No branch selected")
      : selectedBranchItem.protected
        ? buildStateBadge("warning", "Protected branch")
        : buildStateBadge("success", "Ready to deploy");

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="floating-orb floating-orb--cyan -left-24 top-8 size-72 opacity-70" />
        <div className="floating-orb floating-orb--teal -right-20 top-12 size-60 opacity-65" />
        <div className="floating-orb floating-orb--cyan bottom-12 right-1/3 size-52 opacity-45" />
      </div>
      <section className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">GitHub -&gt; Vercel / Netlify / Cloudflare</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              Choose repository and branch, monitor status chips, and open provider setup with prefilled parameters.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge {...repoStateBadge} />
              <StatusBadge {...branchStateBadge} />
              <StatusBadge {...selectedBranchBadge} className={selectedBranchItem?.protected ? "status-pulse" : ""} />
            </div>
          </div>
          <Link
            href="/logout"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-600/80 bg-slate-900/60 px-4 text-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-800/80"
          >
            <IconLogout className="size-4" />
            Logout
          </Link>
        </div>

        <Card className="border-cyan-500/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconRepo className="size-4 text-cyan-300" />
              Repository selection
            </CardTitle>
            <StatusBadge tone={deployDisabled ? "warning" : "success"} label={deployDisabled ? "Deployment blocked" : "Deployment ready"} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label htmlFor="repo-search" className="text-sm text-slate-300">
                Search repository
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="repo-search"
                  className="pl-9"
                  placeholder="owner/repo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="repo-select" className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <IconGithub className="size-4 text-cyan-300" />
                  Repository
                </label>
                <select
                  id="repo-select"
                  value={selectedRepoId}
                  onChange={(event) => {
                    setBranches([]);
                    setBranchesPage(1);
                    setBranchesHasNextPage(false);
                    setSelectedBranch("");
                    setSelectedRepoId(event.target.value);
                  }}
                  className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]"
                  disabled={reposLoading || filteredRepos.length === 0}
                >
                  {filteredRepos.length === 0 ? <option value="">No repositories</option> : null}
                  {filteredRepos.map((repo) => (
                    <option key={repo.id} value={String(repo.id)}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="branch-select" className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <IconBranch className="size-4 text-teal-300" />
                  Branch
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch}
                  onChange={(event) => setSelectedBranch(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]"
                  disabled={branchesLoading || branches.length === 0}
                >
                  {branches.length === 0 ? <option value="">No branches</option> : null}
                  {branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {reposLoading ? <p className="text-sm text-slate-400">Loading repositories...</p> : null}
            {!reposLoading && repos.length === 0 && !reposError ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-300">
                No repositories found. Verify that your OAuth app includes the `repo` scope.
              </p>
            ) : null}
            {reposError ? <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">{reposError}</p> : null}
            {branchesError ? (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">{branchesError}</p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {reposHasNextPage ? (
                <Button type="button" className="w-full sm:w-auto" variant="outline" disabled={reposLoading} onClick={() => setRepoPage((current) => current + 1)}>
                  {reposLoading ? "Loading repositories..." : "Load more repositories"}
                </Button>
              ) : null}
              {selectedRepo && branchesHasNextPage ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={branchesLoading}
                  onClick={() => setBranchesPage((current) => current + 1)}
                >
                  {branchesLoading ? "Loading branches..." : "Load more branches"}
                </Button>
              ) : null}
            </div>

            <Accordion>
              <AccordionTrigger className="inline-flex items-center gap-2"><IconSettings className="size-4 text-slate-300" />Advanced settings (optional)</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="root-directory" className="text-sm text-slate-300">
                      Root directory
                    </label>
                    <Input
                      id="root-directory"
                      placeholder="apps/web"
                      value={rootDirectory}
                      onChange={(event) => setRootDirectory(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="build-command" className="text-sm text-slate-300">
                      Build command
                    </label>
                    <Input
                      id="build-command"
                      placeholder="npm run build"
                      value={buildCommand}
                      onChange={(event) => setBuildCommand(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="output-directory" className="text-sm text-slate-300">
                      Output directory
                    </label>
                    <Input
                      id="output-directory"
                      placeholder=".next"
                      value={outputDirectory}
                      onChange={(event) => setOutputDirectory(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="env-vars" className="text-sm text-slate-300">
                    Environment variables (KEY=VALUE, one per line)
                  </label>
                  <Textarea
                    id="env-vars"
                    value={envText}
                    onChange={(event) => setEnvText(event.target.value)}
                    placeholder={"API_URL=https://api.example.com\nNODE_ENV=production"}
                  />
                  <p className="text-xs text-slate-400">
                    Vercel: only environment variable names are passed. Netlify: keys and values are passed in URL hash. Cloudflare: uses only repository URL via deploy button.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={handleSavePreset}>
                    Save preset
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={handleLoadPreset}>
                    Load preset
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={handleClearPreset}>
                    Clear preset
                  </Button>
                </div>

                {presetNotice ? (
                  <p
                    className={`rounded-xl border p-3 text-xs ${
                      presetNotice.tone === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    {presetNotice.message}
                  </p>
                ) : null}
              </AccordionContent>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="mt-6 border-teal-500/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <IconRocket className="size-4 text-teal-300" />
              Deploy
            </CardTitle>
            <StatusBadge tone={deployDisabled ? "warning" : "success"} label={deployDisabled ? "Select repo + branch" : "Launch providers"} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300 sm:grid-cols-2">
              <p className="break-all">
                <span className="text-slate-400">Repository URL:</span> {selectedRepo?.htmlUrl ?? "-"}
              </p>
              <p>
                <span className="text-slate-400">Selected branch:</span> {selectedBranch || "-"}
              </p>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              <a
                href={vercelUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-14 items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                  deployDisabled
                    ? "pointer-events-none bg-slate-800 text-slate-500"
                    : "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 hover:-translate-y-0.5 hover:bg-cyan-300 hover:shadow-cyan-400/30"
                }`}
              >
                <IconCloud className="size-5" />
                Deploy to Vercel
              </a>
              <a
                href={netlifyUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-14 items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                  deployDisabled
                    ? "pointer-events-none bg-slate-800 text-slate-500"
                    : "bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20 hover:-translate-y-0.5 hover:bg-teal-300 hover:shadow-teal-400/30"
                }`}
              >
                <IconRocket className="size-5" />
                Deploy to Netlify
              </a>
              <a
                href={cloudflareUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-14 items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all duration-200 ${
                  deployDisabled
                    ? "pointer-events-none bg-slate-800 text-slate-500"
                    : "bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 hover:bg-amber-200 hover:shadow-amber-300/30"
                }`}
              >
                <IconBolt className="size-5" />
                Deploy to Cloudflare
              </a>
            </div>

            <div className="grid gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 md:grid-cols-3">
              <p>Vercel: branch is not passed because Deploy Button has no stable documented branch parameter.</p>
              <p>Netlify: branch is passed via query `branch`, root directory via `base`.</p>
              <p>Cloudflare: opens Workers Deploy Button (`url` param). This flow supports Workers apps, not Pages apps.</p>
            </div>

            <div className="pt-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleRefreshRepositories}>
                Refresh repositories
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
