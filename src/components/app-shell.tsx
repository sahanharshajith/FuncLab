"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useUi, type ViewId } from "@/lib/ui-context";
import { Badge, Button, cn } from "@/components/ui/primitives";
import { ErrorBoundary } from "@/components/error-boundary";
import { FunctionsView } from "@/components/functions/functions-view";
import { GraphView } from "@/components/graph/graph-view";
import { TableView } from "@/components/table/table-view";
import { CalculatorView } from "@/components/calculator/calculator-view";
import { ToolsView } from "@/components/tools/tools-view";
import { WorkspacesView } from "@/components/workspaces/workspaces-view";
import { HistoryView } from "@/components/history/history-view";
import { SettingsView } from "@/components/settings/settings-view";
import { Onboarding } from "@/components/onboarding";
import {
  Calculator,
  ChartNoAxesCombined,
  FolderKanban,
  FunctionSquare,
  History,
  Menu,
  Moon,
  Settings,
  Sigma,
  Sun,
  Table2,
  type LucideIcon,
} from "lucide-react";

const NAV: { id: ViewId; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "functions", label: "Functions", icon: FunctionSquare, hint: "Function editor and variables" },
  { id: "graph", label: "Graph", icon: ChartNoAxesCombined, hint: "Interactive graph explorer" },
  { id: "table", label: "Tables", icon: Table2, hint: "Value tables and CSV export" },
  { id: "calculator", label: "Calculator", icon: Calculator, hint: "Scientific calculator" },
  { id: "tools", label: "Analysis", icon: Sigma, hint: "Derivatives, integrals, roots" },
  { id: "workspaces", label: "Workspaces", icon: FolderKanban, hint: "Saved for this tab session" },
  { id: "history", label: "History", icon: History, hint: "Recent calculations" },
  { id: "settings", label: "Settings", icon: Settings, hint: "Preferences and function reference" },
];

const TITLES: Record<ViewId, { title: string; description: string }> = {
  functions: {
    title: "Function workspace",
    description: "Define functions, detect variables automatically and compare results.",
  },
  graph: {
    title: "Graph explorer",
    description: "2D, parametric, polar, implicit, 3D surface and point plots.",
  },
  table: { title: "Value tables", description: "Tabulate functions over a range and export CSV." },
  calculator: { title: "Scientific calculator", description: "Quick calculations in the workspace scope." },
  tools: { title: "Numerical analysis", description: "Derivatives, integrals, roots, extrema, limits, statistics." },
  workspaces: { title: "Workspaces", description: "Workspaces saved for this browser tab session." },
  history: { title: "History", description: "Your recent calculations." },
  settings: { title: "Settings", description: "Angle mode, precision, theme and the function reference." },
};

function ViewRenderer({ view }: { view: ViewId }) {
  switch (view) {
    case "functions":
      return <FunctionsView />;
    case "graph":
      return <GraphView />;
    case "table":
      return <TableView />;
    case "calculator":
      return <CalculatorView />;
    case "tools":
      return <ToolsView />;
    case "workspaces":
      return <WorkspacesView />;
    case "history":
      return <HistoryView />;
    case "settings":
      return <SettingsView />;
    default:
      return null;
  }
}

export function AppShell() {
  const {
    workspace,
    dispatch,
    theme,
    setTheme,
    status,
    setStatus,
    setOnboardingOpen,
    localWorkspaces,
    openWorkspace,
    newWorkspace,
    calculating,
  } = useWorkspaceStore();
  const { view, setView, sidebarOpen, setSidebarOpen } = useUi();

  useEffect(() => {
    if (!status) return;
    const timeout = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [status, setStatus]);

  const angleMode = workspace.data.settings.angleMode;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-30 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              <FunctionSquare size={18} aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">FuncLab</p>
              <p className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">
                Function calculator &amp; graphing platform
              </p>
            </div>
          </div>

          <div className="ml-2 hidden min-w-0 items-center gap-2 md:flex">
            <label className="sr-only" htmlFor="workspace-selector">
              Select workspace
            </label>
            <select
              id="workspace-selector"
              value={`${workspace.storage}:${workspace.id}`}
              onChange={(event) => {
                const [, id] = event.target.value.split(":");
                if (id === "__new__") {
                  newWorkspace();
                  return;
                }
                openWorkspace(id);
              }}
              className="h-8 max-w-[220px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {!localWorkspaces.some((item) => item.id === workspace.id) ? (
                <option value={`${workspace.storage}:${workspace.id}`}>
                  {workspace.name}
                </option>
              ) : null}
              <optgroup label="This tab session">
                {localWorkspaces.map((item) => (
                  <option key={item.id} value={`local:${item.id}`}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
              <option value="local:__new__">+ New workspace</option>
            </select>
            <Badge tone="neutral">session only</Badge>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {calculating ? (
              <span className="hidden text-[11px] text-slate-500 sm:inline">recalculating…</span>
            ) : null}
            <Button
              size="sm"
              onClick={() =>
                dispatch({
                  type: "update-settings",
                  patch: { angleMode: angleMode === "rad" ? "deg" : "rad" },
                })
              }
              title="Toggle angle mode for trigonometric functions"
            >
              {angleMode === "rad" ? "RAD" : "DEG"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Toggle colour theme"
              title="Toggle light / dark theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open the getting started guide"
              title="Help"
              onClick={() => setOnboardingOpen(true)}
            >
              ?
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          aria-label="Main navigation"
          className={cn(
            "fixed inset-y-14 left-0 z-20 w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-full lg:translate-x-0 flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setView(item.id);
                    setSidebarOpen(false);
                  }}
                  title={item.hint}
                  aria-current={view === item.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    view === item.id
                      ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <item.icon size={18} aria-hidden="true" className="shrink-0" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto rounded-lg bg-slate-50 p-3 text-[11px] text-justify hyphens-auto text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="font-medium text-slate-600 dark:text-slate-300">Guest mode</p>
            <p className="mt-1">
              No account needed. Workspaces and history stay in this tab session and are cleared
              when you close it.
            </p>
          </div>
        </nav>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-10 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {TITLES[view].title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {TITLES[view].description}
              </p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto md:hidden">
              {NAV.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs",
                    view === item.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <ErrorBoundary label={TITLES[view].title}>
            <ViewRenderer view={view} />
          </ErrorBoundary>
        </main>
      </div>

      {status ? (
        <div
          className={cn(
            "animate-fade-in fixed bottom-4 right-4 z-40 max-w-sm rounded-xl border px-4 py-2.5 text-xs shadow-lg",
            status.kind === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              : status.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
          )}
          role="status"
          aria-live="polite"
        >
          {status.message}
        </div>
      ) : null}

      <Onboarding />
    </div>
  );
}
