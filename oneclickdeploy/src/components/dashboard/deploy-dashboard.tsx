"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createNetlifyDeployUrl, createVercelDeployUrl } from "@/lib/deploy-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";

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

function formatRateLimitError(error: ApiError): string {
  if (error.resetAt) {
    return `${error.error ?? "GitHub API rate limit exceeded"}. Retry after ${new Date(error.resetAt).toLocaleTimeString()}.`;
  }
  return error.error ?? "Request failed";
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

  useEffect(() => {
    async function loadRepos() {
      setReposLoading(true);
      setReposError(null);

      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const json = (await res.json()) as { repos?: RepoItem[] } & ApiError;

      if (!res.ok) {
        setReposError(formatRateLimitError(json));
        setRepos([]);
        setReposLoading(false);
        return;
      }

      const nextRepos = json.repos ?? [];
      setRepos(nextRepos);

      if (nextRepos.length > 0) {
        const firstRepo = nextRepos[0];
        setSelectedRepoId(String(firstRepo.id));
        setSelectedBranch(firstRepo.defaultBranch);
      } else {
        setSelectedRepoId("");
        setSelectedBranch("");
        setBranches([]);
      }

      setReposLoading(false);
    }

    loadRepos().catch(() => {
      setReposError("Failed to fetch repositories");
      setReposLoading(false);
    });
  }, []);

  const filteredRepos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((repo) => repo.fullName.toLowerCase().includes(q));
  }, [repos, search]);

  const selectedRepo = useMemo(
    () => repos.find((repo) => String(repo.id) === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  );

  useEffect(() => {
    if (!selectedRepo) {
      return;
    }

    const repo = selectedRepo;

    async function loadBranches() {
      setBranchesLoading(true);
      setBranchesError(null);

      const params = new URLSearchParams({ owner: repo.owner, repo: repo.name });
      const res = await fetch(`/api/github/branches?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as { branches?: BranchItem[] } & ApiError;

      if (!res.ok) {
        setBranchesError(formatRateLimitError(json));
        setBranches([]);
        setBranchesLoading(false);
        return;
      }

      const nextBranches = json.branches ?? [];
      setBranches(nextBranches);

      const names = new Set(nextBranches.map((branch) => branch.name));
      setSelectedBranch((current) => {
        if (current && names.has(current)) return current;
        if (names.has(repo.defaultBranch)) return repo.defaultBranch;
        return nextBranches[0]?.name ?? "";
      });

      setBranchesLoading(false);
    }

    loadBranches().catch(() => {
      setBranchesError("Failed to fetch branches");
      setBranchesLoading(false);
    });
  }, [selectedRepo]);

  const deployConfig = {
    rootDirectory,
    buildCommand,
    outputDirectory,
    envText,
  };

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

  const deployDisabled = !selectedRepo || !selectedBranch;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Deploy Buttons</p>
            <h1 className="mt-2 text-3xl font-semibold">GitHub -&gt; Vercel / Netlify</h1>
            <p className="mt-2 text-sm text-slate-300">
              Choose a repository and branch, then open provider setup with prefilled parameters.
            </p>
          </div>
          <Link href="/logout" className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
            Logout
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Repository selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label htmlFor="repo-search" className="text-sm text-slate-300">
                Search repository
              </label>
              <Input
                id="repo-search"
                placeholder="owner/repo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="repo-select" className="text-sm text-slate-300">
                  Repository
                </label>
                <select
                  id="repo-select"
                  value={selectedRepoId}
                  onChange={(event) => setSelectedRepoId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  disabled={reposLoading || filteredRepos.length === 0}
                >
                  {filteredRepos.map((repo) => (
                    <option key={repo.id} value={String(repo.id)}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="branch-select" className="text-sm text-slate-300">
                  Branch
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch}
                  onChange={(event) => setSelectedBranch(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  disabled={branchesLoading || branches.length === 0}
                >
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

            <Accordion>
              <AccordionTrigger>Advanced settings (optional)</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-3">
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
                    Vercel: only environment variable names are passed. Netlify: keys and values are passed in URL hash.
                  </p>
                </div>
              </AccordionContent>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Deploy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p>
                <span className="text-slate-400">Repository URL:</span> {selectedRepo?.htmlUrl ?? "-"}
              </p>
              <p className="mt-2">
                <span className="text-slate-400">Selected branch:</span> {selectedBranch || "-"}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <a
                href={vercelUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-14 items-center justify-center rounded-xl text-base font-semibold transition ${
                  deployDisabled ? "pointer-events-none bg-slate-800 text-slate-500" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                }`}
              >
                Deploy to Vercel
              </a>
              <a
                href={netlifyUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex h-14 items-center justify-center rounded-xl text-base font-semibold transition ${
                  deployDisabled ? "pointer-events-none bg-slate-800 text-slate-500" : "bg-teal-400 text-slate-950 hover:bg-teal-300"
                }`}
              >
                Deploy to Netlify
              </a>
            </div>

            <div className="grid gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100 md:grid-cols-2">
              <p>Vercel: branch is not passed because Deploy Button has no stable documented branch parameter.</p>
              <p>Netlify: branch is passed via query `branch`, root directory via `base`.</p>
            </div>

            <div className="pt-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh repositories
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
