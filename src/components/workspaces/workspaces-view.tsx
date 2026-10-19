"use client";

import { useRef, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { Cloud, FolderKanban, HardDrive } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PanelHeading,
  Spinner,
  TextInput,
} from "@/components/ui/primitives";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function WorkspacesView() {
  const {
    workspace,
    dispatch,
    localWorkspaces,
    cloudWorkspaces,
    cloudStatus,
    cloudError,
    refreshCloud,
    openWorkspace,
    newWorkspace,
    duplicateCurrent,
    deleteWorkspace,
    saveToCloud,
    saveStatus,
    exportWorkspace,
    importWorkspace,
  } = useWorkspaceStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importText, setImportText] = useState("");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <PanelHeading
          title="Current workspace"
          description={
            workspace.storage === "cloud"
              ? "Stored in the PostgreSQL database and auto-saved while you work."
              : "Stored in this browser (guest mode). Save to the cloud to access it from the database."
          }
          actions={
            <>
              <Badge tone={workspace.storage === "cloud" ? "success" : "neutral"}>
                <span className="inline-flex items-center gap-1">
                  {workspace.storage === "cloud" ? <Cloud size={14} /> : <HardDrive size={14} />}
                  {workspace.storage}
                </span>
              </Badge>
              {saveStatus === "saving" ? <Spinner /> : null}
              <Button size="sm" variant="primary" onClick={() => void saveToCloud()}>
                {workspace.storage === "cloud" ? "Save now" : "Save to cloud"}
              </Button>
              <Button size="sm" onClick={duplicateCurrent}>
                Duplicate
              </Button>
              <Button size="sm" onClick={exportWorkspace}>
                Export JSON
              </Button>
              <Button size="sm" onClick={() => newWorkspace()}>
                New
              </Button>
            </>
          }
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="workspace-name">
            <TextInput
              id="workspace-name"
              value={workspace.name}
              onChange={(event) => dispatch({ type: "set-meta", name: event.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="workspace-description">
            <TextInput
              id="workspace-description"
              value={workspace.description}
              placeholder="What is this workspace for?"
              onChange={(event) => dispatch({ type: "set-meta", description: event.target.value })}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>{workspace.data.functions.length} functions</span>
          <span>{workspace.data.variables.length} variables</span>
          <span>updated {formatDate(workspace.updatedAt)}</span>
          {saveStatus === "error" ? (
            <span className="text-red-600 dark:text-red-400">cloud save failed</span>
          ) : null}
        </div>
      </Card>

      <Card>
        <PanelHeading
          title="Local workspaces"
          description="Saved in this browser only — perfect for guest mode."
        />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {localWorkspaces.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">No local workspaces yet.</p>
          ) : null}
          {localWorkspaces.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.name}
                  {item.id === workspace.id ? (
                    <Badge tone="info" className="ml-2">
                      open
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {item.functionCount} functions · {formatDate(item.updatedAt)}
                </p>
              </div>
              <Button size="sm" onClick={() => void openWorkspace(item.id, "local")}>
                Open
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => void deleteWorkspace(item.id, "local")}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <PanelHeading
          title="Cloud workspaces"
          description="Stored in PostgreSQL and shared across devices using your anonymous guest key."
          actions={
            <Button size="sm" onClick={() => void refreshCloud()}>
              {cloudStatus === "loading" ? <Spinner /> : "Refresh"}
            </Button>
          }
        />
        {cloudStatus === "error" ? (
          <div className="px-4 py-3">
            <Alert tone="error">{cloudError ?? "The cloud database is unavailable."}</Alert>
          </div>
        ) : null}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {cloudStatus === "idle" && cloudWorkspaces.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Nothing saved to the cloud yet.
            </p>
          ) : null}
          {cloudWorkspaces.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.name}
                  {item.isTemplate ? <Badge tone="warning">template</Badge> : null}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {item.description || `${item.functionCount} functions`} · {formatDate(item.updatedAt)}
                </p>
              </div>
              <Button size="sm" onClick={() => void openWorkspace(item.id, "cloud")}>
                Open
              </Button>
              {!item.isTemplate ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void deleteWorkspace(item.id, "cloud")}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <PanelHeading
          title="Import workspace"
          description="Paste or upload a previously exported JSON file. Data is validated before import."
        />
        <div className="space-y-3 px-4 py-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              await importWorkspace(text);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              Choose JSON file…
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!importText.trim()}
              onClick={() => void importWorkspace(importText)}
            >
              Import pasted JSON
            </Button>
          </div>
          <textarea
            aria-label="Workspace JSON"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={6}
            placeholder='{"kind":"funclab.workspace","name":"My workspace","data":{…}}'
            className="mono w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </Card>

      {localWorkspaces.length === 0 && cloudWorkspaces.length === 0 ? (
        <div className="xl:col-span-2">
          <EmptyState
            icon={<FolderKanban size={22} aria-hidden="true" />}
            title="No saved workspaces"
            description="Workspaces bundle your functions, variables, graph settings and tables."
            action={<Button variant="primary" onClick={() => newWorkspace()}>Create workspace</Button>}
          />
        </div>
      ) : null}
    </div>
  );
}
