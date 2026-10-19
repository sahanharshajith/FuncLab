"use client";

import { nanoid } from "nanoid";
import type { CalculationRecord, Workspace } from "@/lib/types";
import { coerceWorkspaceData } from "./schema";

const WORKSPACES_STORAGE = "funclab.workspaces";
const ACTIVE_STORAGE = "funclab.activeWorkspace";
const THEME_STORAGE = "funclab.theme";
const ONBOARDING_STORAGE = "funclab.onboardingSeen";
const LOCAL_HISTORY_STORAGE = "funclab.localHistory";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getSessionItem(key: string): string | null {
  const current = window.sessionStorage.getItem(key);
  if (current !== null) return current;

  // Move data from the old persistent guest storage into this tab's session.
  const previous = window.localStorage.getItem(key);
  if (previous !== null) {
    window.sessionStorage.setItem(key, previous);
    window.localStorage.removeItem(key);
  }
  return previous;
}

function setSessionItem(key: string, value: string): void {
  window.sessionStorage.setItem(key, value);
  window.localStorage.removeItem(key);
}

function removeSessionItem(key: string): void {
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}



export function listLocalWorkspaces(): Workspace[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<Workspace[]>(getSessionItem(WORKSPACES_STORAGE), []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.id === "string")
    .map((item) => ({
      ...item,
      storage: "local" as const,
      description: item.description ?? "",
      data: coerceWorkspaceData(item.data),
    }));
}

export function saveLocalWorkspace(workspace: Workspace): void {
  if (typeof window === "undefined") return;
  const all = listLocalWorkspaces();
  const index = all.findIndex((item) => item.id === workspace.id);
  const record: Workspace = { ...workspace, storage: "local" };
  if (index === -1) all.push(record);
  else all[index] = record;
  setSessionItem(WORKSPACES_STORAGE, JSON.stringify(all.slice(-40)));
}

export function deleteLocalWorkspace(id: string): void {
  if (typeof window === "undefined") return;
  const all = listLocalWorkspaces().filter((item) => item.id !== id);
  setSessionItem(WORKSPACES_STORAGE, JSON.stringify(all));
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return getSessionItem(ACTIVE_STORAGE);
}

export function setActiveWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  setSessionItem(ACTIVE_STORAGE, id);
}

export function getStoredTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const value = getSessionItem(THEME_STORAGE);
  return value === "light" || value === "dark" ? value : null;
}

export function storeTheme(theme: "light" | "dark"): void {
  if (typeof window === "undefined") return;
  setSessionItem(THEME_STORAGE, theme);
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return getSessionItem(ONBOARDING_STORAGE) === "1";
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  setSessionItem(ONBOARDING_STORAGE, "1");
}

export function listLocalHistory(): CalculationRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse<CalculationRecord[]>(
    getSessionItem(LOCAL_HISTORY_STORAGE),
    [],
  ).map((item) => ({ ...item, storage: "local" as const }));
}

export function appendLocalHistory(record: Omit<CalculationRecord, "id" | "storage">): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: nanoid(10), storage: "local" };
  if (typeof window === "undefined") return entry;
  const all = [entry, ...listLocalHistory()].slice(0, 100);
  setSessionItem(LOCAL_HISTORY_STORAGE, JSON.stringify(all));
  return entry;
}

export function clearLocalHistory(): void {
  if (typeof window === "undefined") return;
  removeSessionItem(LOCAL_HISTORY_STORAGE);
}
