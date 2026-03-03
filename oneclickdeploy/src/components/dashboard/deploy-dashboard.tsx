"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCloudflareDeployUrl,
  createNetlifyDeployUrl,
  createRailwayDeployUrl,
  createRenderDeployUrl,
  createVercelDeployUrl,
} from "@/lib/deploy-links";
import {
  clearDeployPreset,
  deleteDeployPresetItem,
  loadDeployPresetItems,
  migratePresetStorageToV2,
  saveNamedDeployPreset,
  type DeployPresetFields,
  type DeployPresetItem,
} from "@/lib/deploy-preset";
import {
  clearDeployHistory,
  loadDeployHistory,
  recordDeployHistory,
  type DeployHistoryEntry,
  type DeployProvider,
} from "@/lib/deploy-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  IconBolt,
  IconBranch,
  IconCloud,
  IconGithub,
  IconLogout,
  IconRepo,
  IconRocket,
  IconSearch,
  IconSettings,
} from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { SkeletonList } from "@/components/ui/skeleton";
import { DeployConfirmModal } from "@/components/ui/deploy-confirm-modal";
import { parseEnvText } from "@/lib/deploy-links";

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



type RepoConfigResponse = {
  framework?: string;
  recommendation?: {
    rootDirectory?: string;
    buildCommand?: string;
    outputDirectory?: string;
  };
  notes?: string[];
  envKeys?: string[];
};

type DeploymentStatus = {
  id: number;
  environment: string;
  state: string;
  description: string | null;
  ref: string;
  createdAt: string;
  updatedAt: string;
  creator: string | null;
  targetUrl: string | null;
  environmentUrl: string | null;
  logUrl: string | null;
};

const REPO_PAGE_SIZE = 30;
const BRANCH_PAGE_SIZE = 100;
const DEPLOY_POLL_INTERVAL_MS = 5000;
const DEPLOY_POLL_MAX_DURATION_MS = 5 * 60 * 1000;

type CommitItem = {
  sha: string;
  fullSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

function formatRateLimitError(error: ApiError): string {
  if (error.resetAt) {
    return `${error.error ?? "GitHub API rate limit exceeded"}. Retry after ${new Date(error.resetAt).toLocaleTimeString()}.`;
  }
  return error.error ?? "Request failed";
}

function buildStateBadge(tone: StatusTone, label: string) {
  return { tone, label } as const;
}

function normalizeHistoryText(value: string): string {
  return value.trim();
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
  const [presetName, setPresetName] = useState("");
  const [presetItems, setPresetItems] = useState<DeployPresetItem[]>([]);
  const [historyItems, setHistoryItems] = useState<DeployHistoryEntry[]>([]);
  const [repoRecommendationNotes, setRepoRecommendationNotes] = useState<
    string[]
  >([]);
  const [repoRecommendationFramework, setRepoRecommendationFramework] =
    useState<string>("unknown");
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const [reposLoading, setReposLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  
  const [repoPage, setRepoPage] = useState(1);
  const [reposHasNextPage, setReposHasNextPage] = useState(false);
  const [branchesPage, setBranchesPage] = useState(1);
  const [branchesHasNextPage, setBranchesHasNextPage] = useState(false);
  const [reposRefreshNonce, setReposRefreshNonce] = useState(0);

  const [deployStatuses, setDeployStatuses] = useState<DeploymentStatus[]>([]);
  const [statusPolling, setStatusPolling] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; provider: DeployProvider; deployUrl: string }>({
    open: false,
    provider: "vercel",
    deployUrl: "#",
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [openLogsId, setOpenLogsId] = useState<number | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<Record<number, string[]>>({});
  const [logsLoading, setLogsLoading] = useState(false);

  async function fetchLogs(deploymentId: number) {
    if (!selectedRepo) return;
    setLogsLoading(true);
    try {
      const res = await fetch(
        `/api/github/logs?owner=${selectedRepo.owner}&repo=${selectedRepo.name}&deploymentId=${deploymentId}`,
      );
      const json = await res.json();
      if (json.logLines) {
        setDeploymentLogs((prev) => ({ ...prev, [deploymentId]: json.logLines }));
      }
    } catch {
      toast("error", "Не удалось загрузить логи");
    } finally {
      setLogsLoading(false);
    }
  }

  // Poll logs if terminal is open and deployment is not in a final state
  useEffect(() => {
    if (openLogsId === null) return;

    const dep = deployStatuses.find((d) => d.id === openLogsId);
    if (!dep || ["ready", "error", "inactive"].includes(dep.state)) return;

    const interval = setInterval(() => {
      fetchLogs(openLogsId);
    }, 5000);

    return () => clearInterval(interval);
  }, [openLogsId, deployStatuses]);

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());

  function toggleRepoSelection(repoId: string) {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  }

  function applyDeployFields(fields: DeployPresetFields) {
    setRootDirectory(fields.rootDirectory);
    setBuildCommand(fields.buildCommand);
    setOutputDirectory(fields.outputDirectory);
    setEnvText(fields.envText);
  }

  function readPresetItemsIntoState() {
    const result = loadDeployPresetItems();
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    setPresetItems(result.items);
  }

  function readHistoryIntoState() {
    const result = loadDeployHistory();
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    setHistoryItems(result.items);
  }

  useEffect(() => {
    const migrateResult = migratePresetStorageToV2();
    if (!migrateResult.ok) {
      toast("error", migrateResult.error);
      return;
    }

    readPresetItemsIntoState();
    readHistoryIntoState();
  }, []);

  useEffect(() => {
    async function loadRepos() {
      setReposLoading(true);
      setReposError(null);

      const params = new URLSearchParams({
        page: String(repoPage),
        perPage: String(REPO_PAGE_SIZE),
      });
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

  useEffect(() => {
    setRepoRecommendationFramework("unknown");
    setRepoRecommendationNotes([]);
    setCommits([]);
  }, [selectedRepoId]);

  // Load commits when branch changes
  useEffect(() => {
    if (!selectedRepo || !selectedBranch) {
      setCommits([]);
      return;
    }

    let cancelled = false;
    setCommitsLoading(true);

    async function loadCommits() {
      try {
        const res = await fetch(
          `/api/github/commits?owner=${encodeURIComponent(selectedRepo!.owner)}&repo=${encodeURIComponent(selectedRepo!.name)}&branch=${encodeURIComponent(selectedBranch)}`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { commits?: CommitItem[] };
        if (!cancelled) setCommits(json.commits ?? []);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setCommitsLoading(false);
      }
    }

    loadCommits();
    return () => { cancelled = true; };
  }, [selectedRepo, selectedBranch]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K → focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const deployConfig: DeployPresetFields = {
    rootDirectory,
    buildCommand,
    outputDirectory,
    envText,
  };

  function handleSavePreset() {
    const result = saveNamedDeployPreset(presetName, deployConfig);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    setPresetName("");
    readPresetItemsIntoState();
    toast("success", `Template \"${result.item.name}\" saved locally.`);
  }

  function handleLoadPreset(item: DeployPresetItem) {
    applyDeployFields(item);
    toast("success", `Template \"${item.name}\" loaded.`);
  }

  function handleDeletePreset(id: string) {
    const result = deleteDeployPresetItem(id);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    readPresetItemsIntoState();
    toast("success", "Template removed.");
  }

  function handleClearPreset() {
    const result = clearDeployPreset();
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    toast("success", "Saved preset removed.");
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

  async function handleAutoRecommendConfig() {
    if (!selectedRepo) {
      toast("error", "Select a repository first.");
      return;
    }

    setRecommendationLoading(true);
    try {
      const params = new URLSearchParams({
        owner: selectedRepo.owner,
        repo: selectedRepo.name,
      });

      const res = await fetch(`/api/github/repo-config?${params.toString()}`);
      const json = (await res.json()) as RepoConfigResponse & ApiError;

      if (!res.ok) {
        toast("error", formatRateLimitError(json));
        return;
      }

      const recommendation = json.recommendation;
      const discoveredEnvKeys = json.envKeys ?? [];
      const currentEnvText = envText.trim();

      // Auto-fill env from .env.example if user hasn't typed anything yet
      let finalEnvText = envText;
      if (!currentEnvText && discoveredEnvKeys.length > 0) {
        finalEnvText = discoveredEnvKeys.map((key) => `${key}=`).join("\n");
      }

      if (recommendation) {
        applyDeployFields({
          rootDirectory: recommendation.rootDirectory ?? "",
          buildCommand: recommendation.buildCommand ?? "",
          outputDirectory: recommendation.outputDirectory ?? "",
          envText: finalEnvText,
        });
      }

      setRepoRecommendationFramework(json.framework ?? "unknown");
      setRepoRecommendationNotes(json.notes ?? []);
      toast("success", `Авто-рекомендация применена.${discoveredEnvKeys.length > 0 ? ` Обнаружено ${discoveredEnvKeys.length} переменных из .env.example.` : ""}`);
    } catch {
      toast("error", "Failed to auto-detect repository configuration.");
    } finally {
      setRecommendationLoading(false);
    }
  }

  function getDeployUrlByProvider(provider: DeployProvider): string {
    if (provider === "vercel") return vercelUrl;
    if (provider === "netlify") return netlifyUrl;
    if (provider === "railway") return railwayUrl;
    if (provider === "render") return renderUrl;
    return cloudflareUrl;
  }

  function getHistoryConfigEntry(
    entry: DeployHistoryEntry,
  ): DeployPresetFields {
    return {
      rootDirectory: entry.rootDirectory,
      buildCommand: entry.buildCommand,
      outputDirectory: entry.outputDirectory,
      envText,
    };
  }

  const fetchDeployStatuses = useCallback(async () => {
    if (!selectedRepo) return;
    try {
      const res = await fetch(
        `/api/github/deployments?owner=${encodeURIComponent(selectedRepo.owner)}&repo=${encodeURIComponent(selectedRepo.name)}`,
      );
      if (!res.ok) {
        setStatusError("Не удалось получить статус деплоев");
        return;
      }
      const json = (await res.json()) as { deployments?: DeploymentStatus[] };
      const items = json.deployments ?? [];
      setDeployStatuses(items);
      setStatusError(null);

      // Auto-stop if all deployments are in terminal state
      const allTerminal = items.length > 0 && items.every((d) => d.state === "ready" || d.state === "error" || d.state === "inactive");
      if (allTerminal) {
        stopPolling();
      }
    } catch {
      setStatusError("Ошибка сети при запросе статуса деплоев");
    }
  }, [selectedRepo]);

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setStatusPolling(false);
  }

  function startPolling() {
    stopPolling();
    pollStartRef.current = Date.now();
    setStatusPolling(true);
    setStatusError(null);

    // Immediate first fetch
    fetchDeployStatuses();

    pollIntervalRef.current = setInterval(() => {
      // Auto-stop after max duration
      if (Date.now() - pollStartRef.current > DEPLOY_POLL_MAX_DURATION_MS) {
        stopPolling();
        return;
      }
      fetchDeployStatuses();
    }, DEPLOY_POLL_INTERVAL_MS);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  function handleBulkDeploy(provider: DeployProvider) {
    const selectedRepos = repos.filter((r) => selectedRepoIds.has(String(r.id)));
    if (selectedRepos.length === 0) return;

    toast(
      "info",
      `Запуск массового деплоя для ${selectedRepos.length} репозиториев через ${provider}...`,
    );

    selectedRepos.forEach((repo, index) => {
      const config: DeployPresetFields = {
        rootDirectory: "",
        buildCommand: "",
        outputDirectory: "",
        envText: "",
      };

      const repoInfo = {
        owner: repo.owner,
        name: repo.name,
        htmlUrl: repo.htmlUrl,
        branch: repo.defaultBranch,
      };

      let deployUrl = "#";
      if (provider === "vercel") deployUrl = createVercelDeployUrl(repoInfo, config);
      else if (provider === "netlify") deployUrl = createNetlifyDeployUrl(repoInfo, config);
      else if (provider === "cloudflare") deployUrl = createCloudflareDeployUrl(repoInfo);
      else if (provider === "railway") deployUrl = createRailwayDeployUrl(repoInfo, config);
      else if (provider === "render") deployUrl = createRenderDeployUrl(repoInfo);

      setTimeout(() => {
        window.open(deployUrl, "_blank", "noopener,noreferrer");
        recordDeployHistory({
          provider,
          repoFullName: repo.fullName,
          repoUrl: repo.htmlUrl,
          branch: repo.defaultBranch,
          config,
          deployUrl,
        });
        readHistoryIntoState();
      }, index * 400);
    });
  }

  function triggerDeploy(provider: DeployProvider) {
    if (!selectedRepo || !selectedBranch) return;
    const deployUrl = getDeployUrlByProvider(provider);
    setConfirmModal({
      open: true,
      provider,
      deployUrl,
    });
  }

  function executeDeploy() {
    const { provider, deployUrl } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, open: false }));

    if (!selectedRepo || !selectedBranch || !deployUrl) return;

    const result = recordDeployHistory({
      provider,
      repoFullName: selectedRepo.fullName,
      repoUrl: selectedRepo.htmlUrl,
      branch: selectedBranch,
      config: deployConfig,
      deployUrl,
    });

    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    readHistoryIntoState();
    startPolling();
    window.open(deployUrl, "_blank", "noopener,noreferrer");
    toast("success", `Деплой через ${provider} запущен!`);
  }

  function handleApplyHistoryEntry(entry: DeployHistoryEntry) {
    applyDeployFields(getHistoryConfigEntry(entry));
    setSearch(normalizeHistoryText(entry.repoFullName));
    setSelectedBranch(entry.branch);
    toast("success", `Applied settings from ${entry.provider} run.`);
  }

  function handleClearHistory() {
    const result = clearDeployHistory();
    if (!result.ok) {
      toast("error", result.error);
      return;
    }

    readHistoryIntoState();
    toast("success", "Deploy history cleared.");
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
    ? createCloudflareDeployUrl({
        owner: selectedRepo.owner,
        name: selectedRepo.name,
        htmlUrl: selectedRepo.htmlUrl,
        branch: selectedBranch,
      })
    : "#";

  const railwayUrl = selectedRepo
    ? createRailwayDeployUrl(
        {
          owner: selectedRepo.owner,
          name: selectedRepo.name,
          htmlUrl: selectedRepo.htmlUrl,
          branch: selectedBranch,
        },
        deployConfig,
      )
    : "#";

  const renderUrl = selectedRepo
    ? createRenderDeployUrl({
        owner: selectedRepo.owner,
        name: selectedRepo.name,
        htmlUrl: selectedRepo.htmlUrl,
        branch: selectedBranch,
      })
    : "#";
  const deployDisabled = !selectedRepo || !selectedBranch;

  const repoStateBadge = reposLoading
    ? buildStateBadge("loading", "Репозитории: загрузка")
    : reposError
      ? buildStateBadge("error", "Репозитории: ошибка")
      : repos.length === 0
        ? buildStateBadge("warning", "Репозитории: пусто")
        : buildStateBadge("success", `Репозитории: ${repos.length}`);

  const branchStateBadge = !selectedRepo
    ? buildStateBadge("neutral", "Ветка: не выбрана")
    : branchesLoading
      ? buildStateBadge("loading", "Ветки: загрузка")
      : branchesError
        ? buildStateBadge("error", "Ветки: ошибка")
        : branches.length === 0
          ? buildStateBadge("warning", "Ветки: пусто")
          : buildStateBadge("success", `Ветки: ${branches.length}`);

  const selectedBranchBadge = !selectedBranchItem
    ? buildStateBadge("neutral", "Нет выбранной ветки")
    : selectedBranchItem.protected
      ? buildStateBadge("warning", "Защищенная ветка")
      : buildStateBadge("success", "Готово к деплою");
  return (
    <main className="relative min-h-screen bg-black text-white font-mono selection:bg-[#ff4500] selection:text-black">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />

      <section className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[#333333] pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-[#ff4500] font-bold">
              Протокол Деплоя
            </p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-3xl md:text-4xl font-sans">
              GitHub -&gt; Vercel / Netlify / Cloudflare
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400 sm:text-base">
              Выберите репозиторий и ветку, проверьте статус и откройте окно
              провайдера с заполненными параметрами.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge {...repoStateBadge} />
              <StatusBadge {...branchStateBadge} />
              <StatusBadge
                {...selectedBranchBadge}
                className={
                  selectedBranchItem?.protected
                    ? "animate-pulse border-red-500 text-red-500"
                    : ""
                }
              />
            </div>
          </div>
          <Link
            href="/logout"
            className="inline-flex h-12 uppercase tracking-widest items-center justify-center gap-2 rounded-none px-6 text-sm font-bold bg-transparent border border-[#333333] text-white hover:border-[#ff4500] hover:text-[#ff4500] shadow-[4px_4px_0px_0px_#ff4500] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#ff4500]"
          >
            <IconLogout className="size-4" />
            Выйти
          </Link>
        </div>

        <Card className="rounded-none border-[#333333] bg-black brutalist-shadow mb-6">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#333333] bg-[#111]">
            <CardTitle className="flex items-center gap-2 uppercase font-black tracking-widest text-[#ff4500]">
              <IconRepo className="size-4" />
              Выбор репозитория
            </CardTitle>
            <StatusBadge
              tone={deployDisabled ? "warning" : "success"}
              label={deployDisabled ? "Блокировка" : "Готово"}
            />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3 mb-6">
              <label
                htmlFor="repo-search"
                className="text-sm font-bold uppercase tracking-widest"
              >
                Поиск репозитория
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="repo-search"
                  className="pl-9 h-12 rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500]"
                  placeholder="owner/repo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  ref={searchInputRef}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 mt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Режим Выбора</p>
              <div className="flex border border-[#333333] p-1 scale-90 origin-right">
                <button
                  type="button"
                  onClick={() => setIsBulkMode(false)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-tighter transition-all ${!isBulkMode ? "bg-[#ff4500] text-black" : "text-gray-500 hover:text-white"}`}
                >
                  Одиночный
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkMode(true)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-tighter transition-all ${isBulkMode ? "bg-[#ff4500] text-black" : "text-gray-500 hover:text-white"}`}
                >
                  Массовый
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className={`space-y-2 ${isBulkMode ? "lg:col-span-2" : ""}`}>
                <label
                  htmlFor="repo-select"
                  className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#ff4500]"
                >
                  <IconRepo className="size-4" />
                  {isBulkMode ? "Выбор репозиториев (Массово)" : "Репозиторий"}
                </label>
                
                {isBulkMode ? (
                  <div className="border border-[#333333] bg-[#0a0a0a] min-h-[160px] max-h-[300px] overflow-y-auto p-2 space-y-1 brutalist-shadow custom-scrollbar">
                    {filteredRepos.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-500 font-mono italic">
                        {reposLoading ? "Загрузка..." : "Репозитории не найдены"}
                      </div>
                    ) : (
                      filteredRepos.map((repo) => {
                        const isSelected = selectedRepoIds.has(String(repo.id));
                        return (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => toggleRepoSelection(String(repo.id))}
                            className={`w-full flex items-center gap-3 p-3 text-left text-sm font-mono transition-all border ${
                              isSelected 
                                ? "border-[#ff4500] bg-[#ff4500]/10 text-white" 
                                : "border-transparent text-gray-400 hover:text-white hover:bg-[#111]"
                            }`}
                          >
                            <div className={`size-4 border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-[#ff4500] bg-[#ff4500]" : "border-[#333333]"
                            }`}>
                              {isSelected && <div className="size-2 bg-black" />}
                            </div>
                            <span className="truncate">{repo.fullName}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
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
                    className="h-12 w-full rounded-none border border-[#333333] bg-black px-3 text-sm text-white outline-none transition focus:border-[#ff4500] focus:ring-1 focus:ring-[#ff4500]"
                    disabled={reposLoading || filteredRepos.length === 0}
                  >
                    {filteredRepos.length === 0 ? (
                      <option value="">Нет репозиториев</option>
                    ) : (
                      <>
                        <option value="" disabled>Выберите репозиторий</option>
                        {filteredRepos.map((repo) => (
                          <option key={repo.id} value={String(repo.id)}>
                            {repo.fullName}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>

              {!isBulkMode && (
                <div className="space-y-2">
                  <label
                    htmlFor="branch-select"
                    className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#ff4500]"
                  >
                    <IconBranch className="size-4" />
                    Ветка
                  </label>
                  <select
                    id="branch-select"
                    value={selectedBranch}
                    onChange={(event) => setSelectedBranch(event.target.value)}
                    className="h-12 w-full rounded-none border border-[#333333] bg-black px-3 text-sm text-white outline-none transition focus:border-[#ff4500] focus:ring-1 focus:ring-[#ff4500]"
                    disabled={branchesLoading || branches.length === 0}
                  >
                    {branches.length === 0 ? (
                      <option value="">Нет веток</option>
                    ) : (
                      <>
                        <option value="" disabled>Выберите ветку</option>
                        {branches.map((branch) => (
                          <option key={branch.name} value={branch.name}>
                            {branch.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>

            {reposLoading ? (
              <p className="text-sm text-gray-400 font-mono mt-4">
                Загрузка репозиториев...
              </p>
            ) : null}
            {!reposLoading && repos.length === 0 && !reposError ? (
              <p className="mt-4 border border-[#333333] p-4 text-sm text-gray-400 font-mono">
                Репозитории не найдены. Убедитесь, что ваше OAuth приложение
                имеет scope [repo].
              </p>
            ) : null}
            {reposError ? (
              <p className="mt-4 border border-red-900 bg-black text-red-500 p-4 text-sm font-mono font-bold">
                {reposError}
              </p>
            ) : null}
            {branchesError ? (
              <p className="mt-4 border border-red-900 bg-black text-red-500 p-4 text-sm font-mono font-bold">
                {branchesError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {reposHasNextPage ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  variant="outline"
                  disabled={reposLoading}
                  onClick={() => setRepoPage((current) => current + 1)}
                >
                  {reposLoading
                    ? "Загрузка..."
                    : "Загрузить больше репозиториев"}
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
                  {branchesLoading ? "Загрузка..." : "Загрузить больше веток"}
                </Button>
              ) : null}
            </div>

            {isBulkMode && selectedRepoIds.size > 0 && (
              <div className="mt-8 border-t border-[#333333] pt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col text-left">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#ff4500]">
                      Массовый деплой
                    </p>
                    <p className="text-[10px] font-mono text-gray-500">
                      Выбрано проектов: {selectedRepoIds.size}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRepoIds(new Set())}
                    className="text-[10px] uppercase font-bold text-gray-500 hover:text-white underline underline-offset-4"
                  >
                    Сбросить выбор
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Button
                    variant="outline"
                    className="h-10 text-[10px]"
                    onClick={() => handleBulkDeploy("vercel")}
                  >
                    Vercel
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-[10px]"
                    onClick={() => handleBulkDeploy("netlify")}
                  >
                    Netlify
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-[10px]"
                    onClick={() => handleBulkDeploy("cloudflare")}
                  >
                    Cloudflare
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-[10px]"
                    onClick={() => handleBulkDeploy("railway")}
                  >
                    Railway
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-[10px]"
                    onClick={() => handleBulkDeploy("render")}
                  >
                    Render
                  </Button>
                </div>
                <p className="mt-4 text-[10px] text-gray-500 font-mono italic">
                  * Будут открыты новые вкладки с деплоем веток по умолчанию.
                  Всплывающие окна должны быть разрешены в браузере.
                </p>
              </div>
            )}

            <Accordion>
              <AccordionTrigger className="inline-flex items-center gap-2 uppercase tracking-widest font-bold">
                <IconSettings className="size-4 text-[#ff4500]" />
                Дополнительные настройки (Опционально)
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 lg:grid-cols-3 pt-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="root-directory"
                      className="text-sm font-bold uppercase tracking-widest"
                    >
                      Корневая директория (Root)
                    </label>
                    <Input
                      id="root-directory"
                      placeholder="apps/web"
                      value={rootDirectory}
                      onChange={(event) => setRootDirectory(event.target.value)}
                      className="rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="build-command"
                      className="text-sm font-bold uppercase tracking-widest"
                    >
                      Команда сборки (Build)
                    </label>
                    <Input
                      id="build-command"
                      placeholder="npm run build"
                      value={buildCommand}
                      onChange={(event) => setBuildCommand(event.target.value)}
                      className="rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="output-directory"
                      className="text-sm font-bold uppercase tracking-widest"
                    >
                      Директория вывода (Output)
                    </label>
                    <Input
                      id="output-directory"
                      placeholder=".next"
                      value={outputDirectory}
                      onChange={(event) =>
                        setOutputDirectory(event.target.value)
                      }
                      className="rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500]"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label
                    htmlFor="env-vars"
                    className="text-sm font-bold uppercase tracking-widest"
                  >
                    Переменные окружения (KEY=VALUE, по одной на строку)
                  </label>
                  <Textarea
                    id="env-vars"
                    value={envText}
                    onChange={(event) => setEnvText(event.target.value)}
                    placeholder={
                      "API_URL=https://api.example.com\nNODE_ENV=production"
                    }
                    className="rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500] min-h-[100px]"
                  />
                  <p className="text-xs text-gray-400 font-mono">
                    Vercel: передаются только имена ключей. Netlify: ключи и
                    значения в URL hash. Cloudflare: не передаются переменные
                    окружения, только URL репозитория.
                  </p>
                </div>

                <div className="mt-6 border border-[#333333] bg-black p-4 brutalist-shadow">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-bold uppercase tracking-widest text-[#ff4500]">
                      Автоматические рекомендации
                    </p>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="outline"
                      disabled={recommendationLoading || !selectedRepo}
                      onClick={handleAutoRecommendConfig}
                    >
                      {recommendationLoading
                        ? "Детектирование..."
                        : "Распознать конфигурацию репозитория"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 font-mono">
                    Распознанный фреймворк:{" "}
                    <span className="text-white bg-[#333333] px-1">
                      {repoRecommendationFramework}
                    </span>
                  </p>
                  {repoRecommendationNotes.length > 0 ? (
                    <ul className="mt-2 list-none space-y-1 text-xs text-gray-300 font-mono">
                      {repoRecommendationNotes.map((note) => (
                        <li
                          key={note}
                          className="before:content-['>_'] before:mr-2 before:text-[#ff4500]"
                        >
                          {note}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-6 border border-[#333333] p-4 brutalist-shadow">
                  <p className="text-sm font-bold uppercase tracking-widest text-[#ff4500] mb-4">
                    Сохранение Шаблонов
                  </p>
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                    <Input
                      placeholder="Имя шаблона (напр. Next.js Default)"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      className="w-full sm:max-w-xs rounded-none border-[#333333] bg-black focus-visible:ring-1 focus-visible:ring-[#ff4500]"
                    />
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={handleSavePreset}
                    >
                      Сохранить шаблон
                    </Button>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={handleClearPreset}
                    >
                      Очистить все
                    </Button>
                  </div>

                  <div className="space-y-4 mt-6">
                    <p className="text-sm font-bold uppercase tracking-widest">
                      Сохраненные шаблоны
                    </p>
                    {presetItems.length === 0 ? (
                      <p className="text-xs text-gray-500 font-mono">
                        Нет сохраненных шаблонов.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {presetItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 border border-[#333333] bg-black p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-bold">{item.name}</p>
                              <p className="text-xs text-gray-500 font-mono">
                                Обновлен:{" "}
                                {new Date(item.updatedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => handleLoadPreset(item)}
                              >
                                Загрузить
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full sm:w-auto border-red-900 border text-red-500 hover:bg-black hover:text-red-500 hover:border-red-500"
                                onClick={() => handleDeletePreset(item.id)}
                              >
                                Удалить
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>


              </AccordionContent>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="rounded-none border-[#333333] bg-black brutalist-shadow mt-6">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#333333] bg-[#111]">
            <CardTitle className="flex items-center gap-2 uppercase font-black tracking-widest text-[#ff4500]">
              <IconRocket className="size-4" />
              Деплой Системы
            </CardTitle>
            <StatusBadge
              tone={deployDisabled ? "warning" : "success"}
              label={deployDisabled ? "Выберите ветку" : "Системы готовы"}
            />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3 border border-[#333333] bg-[#0a0a0a] p-4 text-sm text-gray-300 font-mono sm:grid-cols-2 brutalist-shadow">
              <p className="break-all">
                <span className="text-[#ff4500] font-bold">
                  URL Репозитория:
                </span>{" "}
                {selectedRepo?.htmlUrl ?? "НЕ ВЫБРАНО"}
              </p>
              <p>
                <span className="text-[#ff4500] font-bold">
                  Ветка (Branch):
                </span>{" "}
                {selectedBranch || "НЕ ВЫБРАНО"}
              </p>
            </div>

            {commitsLoading ? (
              <div className="mt-6 border border-[#333333] bg-[#0a0a0a] p-4 brutalist-shadow">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
                  Загрузка коммитов
                </p>
                <SkeletonList count={3} />
              </div>
            ) : commits.length > 0 ? (
              <div className="mt-6 border border-[#333333] bg-[#0a0a0a] p-4 brutalist-shadow">
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff4500] mb-4">
                  Предпросмотр деплоя (последние коммиты)
                </p>
                <div className="space-y-3">
                  {commits.map((c) => (
                    <div key={c.sha} className="flex flex-col gap-1 text-sm font-mono border-b border-[#333] pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-[#ff4500] hover:underline font-bold">
                          {c.sha}
                        </a>
                        <span className="text-gray-400 truncate" title={c.message}>{c.message}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>@{c.author}</span>
                        <span>·</span>
                        <span>{new Date(c.date).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => triggerDeploy("vercel")}
                className={`inline-flex uppercase tracking-widest h-14 items-center justify-center gap-2 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  deployDisabled
                    ? "pointer-events-none bg-[#111] border border-[#333] text-gray-600"
                    : "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#ff4500] active:shadow-[2px_2px_0px_0px_#ff4500]"
                }`}
              >
                <IconCloud className="size-5" />
                Vercel
              </button>
              <button
                type="button"
                onClick={() => triggerDeploy("netlify")}
                className={`inline-flex uppercase tracking-widest h-14 items-center justify-center gap-2 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  deployDisabled
                    ? "pointer-events-none bg-[#111] border border-[#333] text-gray-600"
                    : "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#00ff00] active:shadow-[2px_2px_0px_0px_#00ff00]"
                }`}
              >
                <IconRocket className="size-5" />
                Netlify
              </button>
              <button
                type="button"
                onClick={() => triggerDeploy("cloudflare")}
                className={`inline-flex uppercase tracking-widest h-14 items-center justify-center gap-2 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  deployDisabled
                    ? "pointer-events-none bg-[#111] border border-[#333] text-gray-600"
                    : "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#ff00ff] active:shadow-[2px_2px_0px_0px_#ff00ff]"
                }`}
              >
                <IconBolt className="size-5" />
                Cloudflare
              </button>
              <button
                type="button"
                onClick={() => triggerDeploy("railway")}
                className={`inline-flex uppercase tracking-widest h-14 items-center justify-center gap-2 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  deployDisabled
                    ? "pointer-events-none bg-[#111] border border-[#333] text-gray-600"
                    : "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#00ccff] active:shadow-[2px_2px_0px_0px_#00ccff]"
                }`}
              >
                <IconRocket className="size-5" />
                Railway
              </button>
              <button
                type="button"
                onClick={() => triggerDeploy("render")}
                className={`inline-flex uppercase tracking-widest h-14 items-center justify-center gap-2 text-sm font-bold transition-all duration-100 will-change-transform active:translate-x-[2px] active:translate-y-[2px] ${
                  deployDisabled
                    ? "pointer-events-none bg-[#111] border border-[#333] text-gray-600"
                    : "bg-white text-black border border-white hover:bg-black hover:text-white shadow-[4px_4px_0px_0px_#ffcc00] active:shadow-[2px_2px_0px_0px_#ffcc00]"
                }`}
              >
                <IconBolt className="size-5" />
                Render
              </button>
            </div>

            <div className="mt-8 grid gap-2 border border-[#333333] bg-black p-4 text-xs text-gray-400 md:grid-cols-3 brutalist-shadow">
              <p>
                Vercel: ветка не передается, Deploy Button не поддерживает
                параметр ветки.
              </p>
              <p>
                Netlify: ветка через `branch`, root через `base`. Railway: env
                передается в URL.
              </p>
              <p>
                Cloudflare: Workers Deploy Button (URL). Render: требуется
                render.yaml в репо.
              </p>
            </div>

            <div className="mt-6 overflow-x-auto border border-[#333333] bg-black p-4 brutalist-shadow">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#ff4500]">
                Матрица возможностей провайдеров
              </p>
              <table className="min-w-full text-left text-xs text-white font-mono">
                <thead>
                  <tr className="text-gray-500 border-b border-[#333333]">
                    <th className="pb-3 pr-4 font-bold uppercase tracking-widest">
                      Провайдер
                    </th>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-widest">
                      Поддержка веток
                    </th>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-widest">
                      Переопределение сборки
                    </th>
                    <th className="pb-3 pr-4 font-bold uppercase tracking-widest">
                      Env
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#333333]/50">
                    <td className="py-3 pr-4 font-bold">Vercel</td>
                    <td className="py-3 pr-4 text-red-400">Нет</td>
                    <td className="py-3 pr-4 text-green-400">Да</td>
                    <td className="py-3 pr-4">Только ключи</td>
                  </tr>
                  <tr className="border-b border-[#333333]/50">
                    <td className="py-3 pr-4 font-bold">Netlify</td>
                    <td className="py-3 pr-4 text-green-400">Да</td>
                    <td className="py-3 pr-4 text-yellow-400">Частично</td>
                    <td className="py-3 pr-4">URL hash</td>
                  </tr>
                  <tr className="border-b border-[#333333]/50">
                    <td className="py-3 pr-4 font-bold">Cloudflare</td>
                    <td className="py-3 pr-4 text-red-400">Нет</td>
                    <td className="py-3 pr-4 text-red-400">Нет</td>
                    <td className="py-3 pr-4">Только URL</td>
                  </tr>
                  <tr className="border-b border-[#333333]/50">
                    <td className="py-3 pr-4 font-bold text-[#00ccff]">
                      Railway
                    </td>
                    <td className="py-3 pr-4 text-red-400">Нет</td>
                    <td className="py-3 pr-4 text-yellow-400">Root dir</td>
                    <td className="py-3 pr-4 text-green-400">Ключ/Значение</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-bold text-[#ffcc00]">
                      Render
                    </td>
                    <td className="py-3 pr-4 text-red-400">Нет</td>
                    <td className="py-3 pr-4 text-red-400">render.yaml</td>
                    <td className="py-3 pr-4">render.yaml</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* === DEPLOY STATUS PANEL === */}
            {(deployStatuses.length > 0 || statusPolling) ? (
              <div className="mt-8 border border-[#333333] bg-[#0a0a0a] p-6 brutalist-shadow">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#333333] pb-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold uppercase tracking-widest text-[#ff4500]">
                      ■ Статус Деплоя
                    </p>
                    {statusPolling ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-400">
                        <span className="inline-block size-2 rounded-full bg-green-400 animate-pulse" />
                        LIVE · {DEPLOY_POLL_INTERVAL_MS / 1000}s
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-gray-600">ОСТАНОВЛЕН</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs"
                      onClick={() => fetchDeployStatuses()}
                    >
                      Обновить
                    </Button>
                    {statusPolling ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs border-red-900 text-red-500 hover:bg-black hover:text-red-500 hover:border-red-500"
                        onClick={stopPolling}
                      >
                        Стоп
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        onClick={startPolling}
                        disabled={!selectedRepo}
                      >
                        Возобновить
                      </Button>
                    )}
                  </div>
                </div>

                {statusError ? (
                  <p className="mt-4 text-xs font-mono text-red-500 border border-red-900 p-3">{statusError}</p>
                ) : null}

                {deployStatuses.length === 0 && statusPolling ? (
                  <p className="mt-6 text-xs font-mono text-gray-500">
                    {">"} Ожидание данных от GitHub Deployments API...
                  </p>
                ) : null}

                <div className="mt-4 space-y-3">
                  {deployStatuses.map((d) => {
                    const stateConfig = {
                      pending: { label: "В ОЧЕРЕДИ", color: "text-yellow-400", bar: "bg-yellow-400", width: "w-1/6" },
                      building: { label: "СБОРКА", color: "text-[#ff4500]", bar: "bg-[#ff4500]", width: "w-3/5" },
                      ready: { label: "ГОТОВО", color: "text-green-400", bar: "bg-green-400", width: "w-full" },
                      error: { label: "ОШИБКА", color: "text-red-500", bar: "bg-red-500", width: "w-full" },
                      inactive: { label: "НЕАКТИВЕН", color: "text-gray-500", bar: "bg-gray-500", width: "w-full" },
                    }[d.state] ?? { label: d.state.toUpperCase(), color: "text-gray-400", bar: "bg-gray-400", width: "w-1/4" };

                    return (
                      <div key={d.id} className="border border-[#333333] bg-black p-4 font-mono text-xs transition-colors hover:border-[#555]">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[#ff4500]">{">"}</span>
                            <span className="text-white font-bold">{d.environment}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-400">{d.ref}</span>
                            {d.creator ? (
                              <>
                                <span className="text-gray-500">·</span>
                                <span className="text-gray-500">@{d.creator}</span>
                              </>
                            ) : null}
                          </div>
                          <span className={`font-bold uppercase tracking-widest ${stateConfig.color}`}>
                            {stateConfig.label}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-2 w-full bg-[#222]">
                          <div
                            className={`h-full ${stateConfig.bar} ${stateConfig.width} transition-all duration-500 ${
                              d.state === "building" ? "animate-pulse" : ""
                            }`}
                          />
                        </div>

                        <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 text-gray-500">
                          <span>{new Date(d.createdAt).toLocaleString()}</span>
                          {d.description ? (
                            <>
                              <span className="hidden sm:inline text-[#333]">|</span>
                              <span className="text-gray-400 truncate max-w-xs">{d.description}</span>
                            </>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3">
                          {d.environmentUrl ? (
                            <a href={d.environmentUrl} target="_blank" rel="noreferrer" className="text-[#ff4500] hover:underline">
                              → Сайт
                            </a>
                          ) : null}
                          {d.targetUrl ? (
                            <a href={d.targetUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white hover:underline">
                              → Детали
                            </a>
                          ) : null}
                          {d.logUrl ? (
                            <a href={d.logUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white hover:underline">
                              → Провайдер
                            </a>
                          ) : null}
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (openLogsId === d.id) {
                                setOpenLogsId(null);
                              } else {
                                setOpenLogsId(d.id);
                                if (!deploymentLogs[d.id]) {
                                  fetchLogs(d.id);
                                }
                              }
                            }}
                            className="text-gray-500 hover:text-white underline underline-offset-4 decoration-gray-700 hover:decoration-white transition-all ml-auto"
                          >
                            {openLogsId === d.id ? "Скрыть терминал" : "Логи события"}
                          </button>
                        </div>

                        {openLogsId === d.id && (
                          <div className="mt-4 border border-[#333333] bg-[#050505] p-3 font-mono text-[10px] brutalist-shadow animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between border-b border-[#222] pb-2 mb-2">
                              <span className="text-[#ff4500] font-bold uppercase tracking-widest flex items-center gap-2">
                                <IconBolt className="size-3" />
                                Терминал Событий
                              </span>
                              <div className="flex gap-1.5">
                                <div className="size-1.5 rounded-full bg-red-900/50" />
                                <div className="size-1.5 rounded-full bg-yellow-900/50" />
                                <div className="size-1.5 rounded-full bg-green-900/50" />
                              </div>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-2">
                              {logsLoading && !deploymentLogs[d.id] ? (
                                <p className="text-gray-600 animate-pulse">{">"} Подключение к потоку данных...</p>
                              ) : (deploymentLogs[d.id] || []).length === 0 ? (
                                <p className="text-gray-600 italic">{">"} Ожидание регистрации события в GitHub API...</p>
                              ) : (
                                deploymentLogs[d.id]?.map((line, idx) => (
                                  <div key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: line }} />
                                ))
                              )}
                              {!["ready", "error", "inactive"].includes(d.state) && (
                                <p className="text-blue-500 animate-pulse mt-1 font-bold">{">"} ПРОСЛУШИВАНИЕ СОБЫТИЙ...</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleRefreshRepositories}
              >
                Обновить репозитории
              </Button>
            </div>

            <div className="mt-8 border border-[#333333] bg-[#0a0a0a] p-6 brutalist-shadow">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#333333] pb-4">
                <p className="text-sm font-bold uppercase tracking-widest text-[#ff4500]">
                  История деплоев
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto border-red-900 border text-red-500 hover:bg-black hover:text-red-500 hover:border-red-500"
                  onClick={handleClearHistory}
                >
                  Очистить историю
                </Button>
              </div>

              {historyItems.length === 0 ? (
                <p className="mt-6 text-xs text-gray-500 font-mono">
                  История пуста. Запустите провайдера для создания первой
                  записи.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {historyItems.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-4 border border-[#333333] bg-black p-4 lg:flex-row lg:items-center lg:justify-between transition-colors hover:border-white"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-white uppercase tracking-widest">
                          {entry.repoFullName}{" "}
                          <span className="text-[#ff4500] ml-2">
                            [{entry.provider}]
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 font-mono flex gap-3">
                          <span>Ветка: {entry.branch || "-"}</span>
                          <span className="text-[#333]">|</span>
                          <span>Root: {entry.rootDirectory || "."}</span>
                          <span className="text-[#333]">|</span>
                          <span>Build: {entry.buildCommand || "-"}</span>
                        </p>
                        <p className="text-xs text-gray-600 font-mono">
                          {new Date(entry.createdAt).toLocaleString()} · Ключи
                          Env:{" "}
                          {entry.envKeys.length > 0
                            ? entry.envKeys.join(", ")
                            : "нет"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => handleApplyHistoryEntry(entry)}
                        >
                          Загрузить конфиг
                        </Button>
                        <a
                          href={entry.deployUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center border border-[#333333] bg-transparent px-4 text-xs font-bold uppercase tracking-widest text-white transition hover:border-[#ff4500] hover:text-[#ff4500] active:translate-x-[2px] active:translate-y-[2px]"
                        >
                          Перезапустить
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <DeployConfirmModal
        open={confirmModal.open}
        onConfirm={executeDeploy}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        provider={confirmModal.provider}
        repoName={selectedRepo?.fullName ?? ""}
        branch={selectedBranch}
        rootDirectory={rootDirectory}
        buildCommand={buildCommand}
        envCount={parseEnvText(envText).length}
      />
    </main>
  );
}
