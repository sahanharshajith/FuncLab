"use client";

/*
 * This store deliberately synchronises React state with external systems
 * (sessionStorage and the document theme) inside effects, which
 * is exactly what the React docs recommend for "subscribe to / hydrate from an
 * external store" flows. The new react-hooks lint rule is relaxed for the file.
 */
/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type {
  CalculationRecord,
  FunctionEvaluation,
  ThemeMode,
  Workspace,
  WorkspaceSummary,
} from "@/lib/types";
import {
  compileWorkspace,
  evaluateWorkspace,
  variableValueMap,
  type CompiledWorkspace,
} from "@/lib/math/workspace-eval";
import { createWorkspace, demoWorkspace, emptyWorkspaceData } from "./defaults";
import { workspaceReducer, type WorkspaceAction } from "./reducer";
import {
  appendLocalHistory,
  clearLocalHistory,
  deleteLocalWorkspace,
  getActiveWorkspaceId,
  getStoredTheme,
  hasSeenOnboarding,
  listLocalHistory,
  listLocalWorkspaces,
  markOnboardingSeen,
  saveLocalWorkspace,
  setActiveWorkspaceId,
  storeTheme,
} from "./persistence";
import { coerceWorkspaceData, workspaceExportSchema } from "./schema";

export type StatusKind = "info" | "success" | "error";

export interface StatusMessage {
  kind: StatusKind;
  message: string;
}

export interface WorkspaceStoreValue {
  workspace: Workspace;
  dispatch: Dispatch<WorkspaceAction>;
  compiled: CompiledWorkspace;
  evaluations: FunctionEvaluation[];
  evaluationById: Map<string, FunctionEvaluation>;
  values: Record<string, number>;
  calculating: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  localWorkspaces: WorkspaceSummary[];
  openWorkspace: (id: string) => void;
  newWorkspace: (name?: string) => void;
  duplicateCurrent: () => void;
  deleteWorkspace: (id: string) => void;
  exportWorkspace: () => void;
  importWorkspace: (json: string) => Promise<void>;
  history: CalculationRecord[];
  addHistory: (entry: { kind: string; expression: string; result: string }) => Promise<void>;
  clearHistory: () => Promise<void>;
  status: StatusMessage | null;
  setStatus: (status: StatusMessage | null) => void;
  onboardingOpen: boolean;
  setOnboardingOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceStoreValue | null>(null);

function summarise(workspace: Workspace): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    storage: workspace.storage,
    functionCount: workspace.data.functions.length,
    updatedAt: workspace.updatedAt,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    null,
    () => createWorkspace("Workspace", emptyWorkspaceData()),
  );
  const [hydrated, setHydrated] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [history, setHistory] = useState<CalculationRecord[]>([]);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // ---------------------------------------------------------------- hydrate
  useEffect(() => {
    const stored = listLocalWorkspaces();
    const activeId = getActiveWorkspaceId();
    const active = stored.find((item) => item.id === activeId) ?? stored[0];
    if (active) {
      dispatch({ type: "replace", workspace: active });
    } else {
      const demo = demoWorkspace();
      saveLocalWorkspace(demo);
      setActiveWorkspaceId(demo.id);
      dispatch({ type: "replace", workspace: demo });
    }
    setLocalWorkspaces(listLocalWorkspaces().map(summarise));
    setHistory(listLocalHistory());
    const storedTheme = getStoredTheme();
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setThemeState(storedTheme ?? (prefersDark ? "dark" : "light"));
    if (!hasSeenOnboarding()) setOnboardingOpen(true);
    setHydrated(true);
  }, []);

  // ------------------------------------------------------------------ theme
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    storeTheme(next);
  }, []);

  // ----------------------------------------------------- session autosaving
  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      saveLocalWorkspace({ ...workspace, storage: "local" });
      setActiveWorkspaceId(workspace.id);
      setLocalWorkspaces(listLocalWorkspaces().map(summarise));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [workspace, hydrated]);

  // ------------------------------------------------------- evaluation layer
  const deferredData = useDeferredValue(workspace.data);
  const compiled = useMemo(
    () => compileWorkspace(deferredData.functions),
    [deferredData.functions],
  );
  const evaluations = useMemo(
    () => evaluateWorkspace(compiled, deferredData.variables, deferredData.settings.angleMode),
    [compiled, deferredData.variables, deferredData.settings.angleMode],
  );
  const evaluationById = useMemo(
    () => new Map(evaluations.map((item) => [item.id, item])),
    [evaluations],
  );
  const values = useMemo(() => variableValueMap(deferredData.variables), [deferredData.variables]);
  const calculating = deferredData !== workspace.data;

  const openWorkspace = useCallback((id: string) => {
    const found = listLocalWorkspaces().find((item) => item.id === id);
    if (!found) {
      setStatus({ kind: "error", message: "Workspace not found in this browser session." });
      return;
    }
    dispatch({ type: "replace", workspace: found });
    setActiveWorkspaceId(found.id);
    setStatus({ kind: "success", message: `Opened "${found.name}".` });
  }, []);

  const newWorkspace = useCallback((name = "Untitled workspace") => {
    const created = createWorkspace(name, emptyWorkspaceData());
    saveLocalWorkspace(created);
    setActiveWorkspaceId(created.id);
    setLocalWorkspaces(listLocalWorkspaces().map(summarise));
    dispatch({ type: "replace", workspace: created });
    setStatus({ kind: "success", message: "Created a workspace for this tab session." });
  }, []);

  const duplicateCurrent = useCallback(() => {
    const copy = createWorkspace(
      `${workspace.name} (copy)`,
      JSON.parse(JSON.stringify(workspace.data)),
      "local",
      workspace.description,
    );
    saveLocalWorkspace(copy);
    setActiveWorkspaceId(copy.id);
    setLocalWorkspaces(listLocalWorkspaces().map(summarise));
    dispatch({ type: "replace", workspace: copy });
    setStatus({ kind: "success", message: "Workspace duplicated in this session." });
  }, [workspace]);

  const deleteWorkspace = useCallback(
    (id: string) => {
      deleteLocalWorkspace(id);
      setLocalWorkspaces(listLocalWorkspaces().map(summarise));
      setStatus({ kind: "success", message: "Workspace deleted from this session." });
      if (id === workspace.id) {
        const remaining = listLocalWorkspaces()[0] ?? demoWorkspace();
        saveLocalWorkspace(remaining);
        setActiveWorkspaceId(remaining.id);
        dispatch({ type: "replace", workspace: remaining });
      }
    },
    [workspace.id],
  );

  const exportWorkspace = useCallback(() => {
    const payload = {
      kind: "funclab.workspace" as const,
      name: workspace.name,
      description: workspace.description,
      exportedAt: new Date().toISOString(),
      data: workspace.data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.name.replace(/[^\w-]+/g, "-").toLowerCase() || "workspace"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: "success", message: "Workspace exported as JSON." });
  }, [workspace]);

  const importWorkspace = useCallback(async (json: string) => {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      setStatus({ kind: "error", message: "That file is not valid JSON." });
      return;
    }
    const result = workspaceExportSchema.safeParse(parsedJson);
    if (!result.success) {
      // Allow importing a bare workspace data object too.
      const data = coerceWorkspaceData((parsedJson as { data?: unknown })?.data ?? parsedJson);
      if (!data.functions.length && !data.variables.length) {
        setStatus({ kind: "error", message: "Import failed: no valid workspace data found." });
        return;
      }
      const imported = createWorkspace("Imported workspace", data);
      saveLocalWorkspace(imported);
      dispatch({ type: "replace", workspace: imported });
      setLocalWorkspaces(listLocalWorkspaces().map(summarise));
      setStatus({ kind: "info", message: "Imported with recovered defaults for invalid sections." });
      return;
    }
    const imported = createWorkspace(result.data.name, result.data.data, "local", result.data.description);
    saveLocalWorkspace(imported);
    setActiveWorkspaceId(imported.id);
    dispatch({ type: "replace", workspace: imported });
    setLocalWorkspaces(listLocalWorkspaces().map(summarise));
    setStatus({ kind: "success", message: `Imported "${imported.name}".` });
  }, []);

  const addHistory = useCallback(
    async (entry: { kind: string; expression: string; result: string }) => {
      const record: CalculationRecord = {
        ...entry,
        id: `tmp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        storage: "local",
      };
      const local = appendLocalHistory({
        kind: entry.kind,
        expression: entry.expression,
        result: entry.result,
        createdAt: record.createdAt,
      });
      setHistory((current) => [local, ...current].slice(0, 100));
    },
    [],
  );

  const clearHistory = useCallback(async () => {
    clearLocalHistory();
    setHistory([]);
  }, []);

  const handleOnboarding = useCallback((open: boolean) => {
    setOnboardingOpen(open);
    if (!open) markOnboardingSeen();
  }, []);

  const value = useMemo<WorkspaceStoreValue>(
    () => ({
      workspace,
      dispatch,
      compiled,
      evaluations,
      evaluationById,
      values,
      calculating,
      theme,
      setTheme,
      localWorkspaces,
      openWorkspace,
      newWorkspace,
      duplicateCurrent,
      deleteWorkspace,
      exportWorkspace,
      importWorkspace,
      history,
      addHistory,
      clearHistory,
      status,
      setStatus,
      onboardingOpen,
      setOnboardingOpen: handleOnboarding,
    }),
    [
      workspace,
      compiled,
      evaluations,
      evaluationById,
      values,
      calculating,
      theme,
      setTheme,
      localWorkspaces,
      openWorkspace,
      newWorkspace,
      duplicateCurrent,
      deleteWorkspace,
      exportWorkspace,
      importWorkspace,
      history,
      addHistory,
      clearHistory,
      status,
      onboardingOpen,
      handleOnboarding,
    ],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          <p className="text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceStore(): WorkspaceStoreValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspaceStore must be used inside <WorkspaceProvider>");
  }
  return context;
}
