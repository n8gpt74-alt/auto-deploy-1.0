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

  const [orgs, setOrgs] = useState<{ id: number; login: string; avatarUrl: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [orgsLoading, setOrgsLoading] = useState(false);

  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

  const [branchDiff, setBranchDiff] = useState<{ aheadBy: number; behindBy: number; status: string; totalCommits: number } | null>(null);
  const [branchDiffLoading, setBranchDiffLoading] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyFilterProvider, setHistoryFilterProvider] = useState<string>("all");

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
    async function fetchOrgs() {
      setOrgsLoading(true);
      try {
        const res = await fetch("/api/github/orgs");
        const json = await res.json();
        if (json.orgs) {
          setOrgs(json.orgs);
        }
      } catch (err) {
        console.error("Failed to fetch orgs", err);
      } finally {
        setOrgsLoading(false);
      }
    }
    fetchOrgs();
  }, []);

  useEffect(() => {
    async function loadRepos() {
      setReposLoading(true);
      setReposError(null);

      const params = new URLSearchParams({
        page: String(repoPage),
        perPage: String(REPO_PAGE_SIZE),
      });
      if (selectedOrg) {
        params.append("org", selectedOrg);
      }
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
  }, [repoPage, reposRefreshNonce, selectedOrg]);

  useEffect(() => {
    async function loadReadme() {
      if (!selectedRepo) {
        setReadmeContent(null);
        return;
      }
      setReadmeLoading(true);
      try {
        const res = await fetch(`/api/github/readme?owner=${selectedRepo.owner}&repo=${selectedRepo.name}`);
        const json = await res.json();
        setReadmeContent(json.content || "Empty README");
      } catch {
        setReadmeContent("Error loading README");
      } finally {
        setReadmeLoading(false);
      }
    }
    loadReadme();
  }, [selectedRepoId]);

  useEffect(() => {
    async function loadBranchDiff() {
      if (!selectedRepo || !selectedBranch || selectedBranch === selectedRepo.defaultBranch) {
        setBranchDiff(null);
        return;
      }
      setBranchDiffLoading(true);
      try {
        const res = await fetch(`/api/github/diff?owner=${selectedRepo.owner}&repo=${selectedRepo.name}&base=${selectedRepo.defaultBranch}&head=${selectedBranch}`);
        const json = await res.json();
        if (json.totalCommits !== undefined) {
          setBranchDiff(json);
        }
      } catch {
        setBranchDiff(null);
      } finally {
        setBranchDiffLoading(false);
      }
    }
    loadBranchDiff();
  }, [selectedRepoId, selectedBranch]);

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

  const filteredHistoryItems = useMemo(() => {
    let items = historyItems;
    if (historySearch) {
      const q = historySearch.toLowerCase();
      items = items.filter((item) => item.repoFullName.toLowerCase().includes(q));
    }
    if (historyFilterProvider !== "all") {
      items = items.filter((item) => item.provider === historyFilterProvider);
    }
    return items;
  }, [historyItems, historySearch, historyFilterProvider]);

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
    <main className="relative min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="canvas-container bg-[radial-gradient(circle_at_50%_50%,rgba(255,69,0,0.05),transparent_70%)] opacity-50" />
      
      <section className="relative z-10 mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16 animate-reveal">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border/50 pb-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                System Online: PROTOCOL v2.0
              </p>
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter sm:text-5xl md:text-6xl font-sans leading-[0.95]">
              Deploy <span className="text-primary italic">One</span> Click
            </h1>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-2 border border-border bg-card/40 px-3 py-2 rounded-lg text-sm">
                <IconGithub className="size-4 text-primary" />
                <select 
                  className="bg-transparent text-sm font-bold uppercase tracking-widest outline-none cursor-pointer"
                  value={selectedOrg}
                  onChange={(e) => {
                    setSelectedOrg(e.target.value);
                    setRepoPage(1);
                    setRepos([]);
                  }}
                >
                  <option value="" className="bg-background">Personal Projects</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.login} className="bg-background">
                      {org.login}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge {...repoStateBadge} />
                <StatusBadge {...branchStateBadge} />
              </div>
            </div>
          </div>
          <Link
            href="/logout"
            className="group inline-flex h-12 uppercase tracking-widest items-center justify-center gap-2 px-6 text-xs font-black bg-white text-black hover:bg-primary hover:text-white transition-all transform hover:-translate-y-1 active:translate-y-0 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-primary/40"
          >
            <IconLogout className="size-4 group-hover:rotate-180 transition-transform duration-500" />
            Termination
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Repo Selection & Config */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-6">
            <Card className="glass-dark animate-reveal [animation-delay:100ms]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
                <CardTitle className="text-primary flex items-center gap-3">
                  <IconRepo className="size-5" />
                  Project Selection
                </CardTitle>
                <div className="flex bg-background/40 p-1 rounded-lg border border-border/50 scale-90">
                  <button
                    onClick={() => setIsBulkMode(false)}
                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${!isBulkMode ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => setIsBulkMode(true)}
                    className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest transition-all rounded-md ${isBulkMode ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Mass
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative group">
                  <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Search repositories..." 
                    className="pl-11 h-12 bg-background/20 border-border/50 focus:border-primary/50"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    ref={searchInputRef}
                  />
                </div>

                {isBulkMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredRepos.map(repo => {
                      const isSelected = selectedRepoIds.has(String(repo.id));
                      return (
                        <button
                          key={repo.id}
                          onClick={() => toggleRepoSelection(String(repo.id))}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                            isSelected 
                              ? "bg-primary/10 border-primary text-foreground" 
                              : "bg-background/20 border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "size-5 rounded-md border flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary border-primary" : "border-border bg-background group-hover:border-primary/50"
                          )}>
                            {isSelected && <div className="size-2 bg-black rounded-sm" />}
                          </div>
                          <span className="text-xs font-bold truncate uppercase tracking-tight">{repo.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Repository</label>
                      <select 
                        className="w-full h-12 bg-background/40 border border-border/50 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                        value={selectedRepoId}
                        onChange={(e) => setSelectedRepoId(e.target.value)}
                      >
                        <option value="" disabled>Choose a project...</option>
                        {filteredRepos.map(repo => (
                          <option key={repo.id} value={String(repo.id)} className="bg-background text-foreground">
                            {repo.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Branch</label>
                       <select 
                        className="w-full h-12 bg-background/40 border border-border/50 rounded-xl px-4 text-sm font-bold outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        disabled={!selectedRepoId || branchesLoading}
                      >
                        {branchesLoading ? <option>Loading...</option> : (
                          <>
                            <option value="" disabled>Choose a branch...</option>
                            {branches.map(b => <option key={b.name} value={b.name} className="bg-background">{b.name}</option>)}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}
                
                {reposHasNextPage && (
                  <Button variant="outline" className="w-full text-[10px] uppercase font-black" onClick={() => setRepoPage(prev => prev+1)}>
                    Load More Repositories
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="glass animate-reveal [animation-delay:200ms]">
               <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <IconSettings className="size-3" />
                    Deployment Parameters
                  </CardTitle>
               </CardHeader>
               <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Root Dir</label>
                      <Input value={rootDirectory} onChange={e => setRootDirectory(e.target.value)} placeholder="e.g. apps/web" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Build Command</label>
                      <Input value={buildCommand} onChange={e => setBuildCommand(e.target.value)} placeholder="npm run build" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Output Dir</label>
                      <Input value={outputDirectory} onChange={e => setOutputDirectory(e.target.value)} placeholder=".next" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Environment Variables</label>
                      <Button variant="outline" className="h-6 text-[8px] uppercase font-black" onClick={handleAutoRecommendConfig}>Auto-Detect Config</Button>
                    </div>
                    <Textarea 
                      value={envText} 
                      onChange={e => setEnvText(e.target.value)} 
                      placeholder="KEY=VALUE" 
                      className="min-h-[120px] bg-background/20 font-mono text-xs"
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex gap-2">
                      <Input placeholder="Template Name" value={presetName} onChange={e => setPresetName(e.target.value)} className="h-10 text-xs" />
                      <Button className="h-10 text-xs font-black px-6" onClick={handleSavePreset}>Save Preset</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                       {presetItems.map(item => (
                         <div key={item.id} className="flex items-center gap-2 bg-background/40 border border-border/50 pl-3 pr-1 py-1 rounded-lg group animate-in slide-in-from-left-2">
                           <span className="text-[10px] font-bold uppercase">{item.name}</span>
                           <Button variant="ghost" className="size-6 p-0 hover:bg-white hover:text-black" onClick={() => handleLoadPreset(item)}>↓</Button>
                           <Button variant="ghost" className="size-6 p-0 hover:bg-destructive hover:text-white" onClick={() => handleDeletePreset(item.id)}>×</Button>
                         </div>
                       ))}
                    </div>
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* Right Column: Intelligence & Preview */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-6">
            <Card className="glass border-primary/20 bg-primary/5 animate-reveal [animation-delay:300ms]">
               <CardHeader className="border-b border-primary/10">
                  <CardTitle className="text-xs font-black flex items-center gap-2">
                    <IconBolt className="size-4 animate-pulse" />
                    Project Intelligence
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0">
                  {selectedRepo ? (
                    <div className="divide-y divide-primary/10">
                       {branchDiff && (
                         <div className="p-5 bg-primary/10 space-y-2">
                            <p className="text-[10px] font-black uppercase text-primary">Branch Analysis</p>
                            <p className="text-lg font-black leading-tight italic">
                              {branchDiff.aheadBy > 0 
                                ? `Ahead by ${branchDiff.aheadBy} commits` 
                                : "No new changes detected"}
                            </p>
                            <div className="flex gap-2 pt-1">
                               <span className="text-[10px] font-mono bg-green-500/20 text-green-400 px-2 py-0.5 rounded">+{branchDiff.aheadBy}</span>
                               <span className="text-[10px] font-mono bg-red-500/20 text-red-400 px-2 py-0.5 rounded">-{branchDiff.behindBy}</span>
                            </div>
                         </div>
                       )}
                       
                       <div className="p-5">
                          <p className="text-[10px] font-black uppercase text-muted-foreground mb-4">README Preview</p>
                          <div className="relative">
                            {readmeLoading ? (
                               <div className="space-y-2">
                                  <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse"></div>
                                  <div className="h-4 bg-white/5 rounded w-full animate-pulse"></div>
                                  <div className="h-4 bg-white/5 rounded w-1/2 animate-pulse"></div>
                               </div>
                            ) : (
                               <div className="text-[11px] font-mono text-muted-foreground leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap">
                                  {readmeContent || "Select a project to analyze intelligence metrics."}
                               </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background/90 to-transparent pointer-events-none"></div>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="p-10 text-center space-y-4">
                       <IconSearch className="size-10 mx-auto text-muted-foreground opacity-20" />
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">Select a project<br/>to begin extraction</p>
                    </div>
                  )}
               </CardContent>
            </Card>

            <Card className="glass animate-reveal [animation-delay:400ms]">
               <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-xs font-black">Quick Launch</CardTitle>
               </CardHeader>
               <CardContent className="pt-6 space-y-3">
                  <div className="grid grid-cols-1 gap-2">
                     <button
                        onClick={() => triggerDeploy("vercel")}
                        disabled={deployDisabled}
                        className="group flex items-center justify-between h-14 w-full bg-white text-black px-5 font-black uppercase tracking-widest text-xs hover:bg-primary hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <div className="flex items-center gap-3">
                          <IconCloud className="size-5" />
                          Vercel
                        </div>
                        <span className="text-[10px] font-mono group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                      <button
                        onClick={() => triggerDeploy("netlify")}
                        disabled={deployDisabled}
                        className="group flex items-center justify-between h-14 w-full bg-white text-black px-5 font-black uppercase tracking-widest text-xs hover:bg-[#00AD9F] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                         <div className="flex items-center gap-3">
                           <IconRocket className="size-5" />
                           Netlify
                         </div>
                         <span className="text-[10px] font-mono group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                      <button
                        onClick={() => triggerDeploy("cloudflare")}
                        disabled={deployDisabled}
                        className="group flex items-center justify-between h-14 w-full bg-white text-black px-5 font-black uppercase tracking-widest text-xs hover:bg-[#F38020] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                      >
                         <div className="flex items-center gap-3">
                           <IconBolt className="size-5" />
                           Cloudflare
                         </div>
                         <span className="text-[10px] font-mono group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                  </div>
               </CardContent>
            </Card>
          </div>
        </div>

        {/* Full Width Row: Active Deployments & History */}
        <div className="mt-10 space-y-10">
          {(deployStatuses.length > 0 || statusPolling) && (
            <Card className="glass-dark border-primary/30 animate-reveal [animation-delay:500ms]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-3">
                  <IconRocket className="size-4 animate-pulse" />
                  Active Extraction Stream
                </CardTitle>
                <div className="flex items-center gap-3">
                   <StatusBadge tone={statusPolling ? "loading" : "neutral"} label={statusPolling ? "Listening" : "Paused"} />
                   <Button variant="ghost" className="size-8 p-0" onClick={() => fetchDeployStatuses()}>↻</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {deployStatuses.length === 0 && statusPolling && (
                  <div className="py-20 text-center opacity-30 italic text-xs font-mono">
                    Awaiting payload from GitHub Deployments...
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {deployStatuses.map(d => {
                    const statusConfig = {
                      pending: { label: "In Queue", color: "text-yellow-400", bar: "bg-yellow-400", width: "w-1/4" },
                      building: { label: "Building", color: "text-primary", bar: "bg-primary", width: "w-3/5" },
                      ready: { label: "Decommissioned", color: "text-green-400", bar: "bg-green-400", width: "w-full" },
                      error: { label: "Critical Error", color: "text-red-500", bar: "bg-red-500", width: "w-full" },
                    }[d.state] || { label: d.state, color: "text-muted-foreground", bar: "bg-muted", width: "w-0" };

                    return (
                      <div key={d.id} className="bg-background/40 border border-border/50 rounded-xl p-5 hover:border-primary/50 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black uppercase text-muted-foreground">{d.environment}</p>
                               <h3 className="text-sm font-black uppercase tracking-tight">{d.ref}</h3>
                            </div>
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-background/50 border", statusConfig.color)}>
                              {statusConfig.label}
                            </span>
                        </div>
                        
                        <div className="h-1 w-full bg-border/10 rounded-full overflow-hidden mb-4">
                            <div className={cn("h-full transition-all duration-1000", statusConfig.bar, statusConfig.width, d.state === "building" && "animate-pulse")} />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold">
                           <div className="flex gap-4">
                              {d.environmentUrl && <a href={d.environmentUrl} target="_blank" className="text-primary hover:underline">Open Site</a>}
                              {d.logUrl && <a href={d.logUrl} target="_blank" className="text-muted-foreground hover:text-foreground italic">Provider Hub</a>}
                           </div>
                           <button 
                              onClick={() => {
                                if (openLogsId === d.id) setOpenLogsId(null);
                                else {
                                  setOpenLogsId(d.id);
                                  if (!deploymentLogs[d.id]) fetchLogs(d.id);
                                }
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
                            >
                              {openLogsId === d.id ? "Hide Logs" : "View Logs"}
                            </button>
                        </div>

                        {openLogsId === d.id && (
                          <div className="mt-5 bg-black rounded-lg border border-border/50 p-4 font-mono text-[9px] animate-in zoom-in-95">
                              <div className="max-h-[150px] overflow-y-auto custom-scrollbar space-y-1 pr-2">
                                 {deploymentLogs[d.id]?.map((line, i) => (
                                   <div key={i} className="opacity-60 hover:opacity-100 transition-opacity" dangerouslySetInnerHTML={{ __html: line }} />
                                 ))}
                                 {!["ready", "error", "inactive"].includes(d.state) && (
                                   <p className="text-primary animate-pulse font-bold mt-2 tracking-widest uppercase">/ / LISTENING_FOR_EVENTS</p>
                                 )}
                              </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass animate-reveal [animation-delay:600ms]">
             <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50">
                <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest italic">
                   Archived Records
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                   <div className="relative">
                      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                      <input 
                        className="h-9 pl-9 pr-4 bg-background/20 border border-border/50 rounded-lg text-[10px] font-bold outline-none focus:border-primary w-full sm:w-56"
                        placeholder="Filter archives..."
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                      />
                   </div>
                   <select 
                      className="h-9 px-3 bg-background/20 border border-border/50 rounded-lg text-[10px] font-bold outline-none focus:border-primary appearance-none cursor-pointer"
                      value={historyFilterProvider}
                      onChange={e => setHistoryFilterProvider(e.target.value)}
                   >
                     <option value="all">All Channels</option>
                     <option value="vercel">Vercel</option>
                     <option value="netlify">Netlify</option>
                     <option value="cloudflare">Cloudflare</option>
                     <option value="railway">Railway</option>
                     <option value="render">Render</option>
                   </select>
                   <Button variant="outline" className="h-9 text-[10px] font-black border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white" onClick={handleClearHistory}>Nuke Archive</Button>
                </div>
             </CardHeader>
             <CardContent className="pt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredHistoryItems.map(entry => (
                     <div key={entry.id} className="group bg-background/20 border border-border/50 rounded-xl p-5 hover:border-white transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">{entry.provider}</p>
                              <h4 className="text-[11px] font-black uppercase truncate max-w-[150px]">{entry.repoFullName}</h4>
                           </div>
                           <p className="text-[9px] font-mono text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-4">
                           <Button variant="ghost" className="flex-1 h-9 text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white hover:text-black" onClick={() => handleApplyHistoryEntry(entry)}>Init Feed</Button>
                           <a href={entry.deployUrl} target="_blank" className="flex-1 h-9 flex items-center justify-center border border-border/50 rounded-lg text-[9px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-all">Re-Deploy</a>
                        </div>
                     </div>
                   ))}
                   {filteredHistoryItems.length === 0 && (
                     <div className="col-span-full py-20 text-center opacity-30 italic text-xs font-mono">
                       {historyItems.length === 0 ? "Archive is currently empty." : "No records matching current filters."}
                     </div>
                   )}
                </div>
             </CardContent>
          </Card>
        </div>
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
