"use client";

import { nanoid } from "nanoid";
import type { CalculationRecord, Workspace, WorkspaceData } from "@/lib/types";
import { coerceWorkspaceData } from "./schema";

const OWNER_KEY_STORAGE = "funclab.ownerKey";
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

export function getOwnerKey(): string {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key || key.length < 8) {
    key = nanoid(21).replace(/[^A-Za-z0-9_-]/g, "_");
    window.localStorage.setItem(OWNER_KEY_STORAGE, key);
  }
  return key;
}

export function listLocalWorkspaces(): Workspace[] {
  if (typeof window === "undefined") return [];
  const raw = safeParse<Workspace[]>(window.localStorage.getItem(WORKSPACES_STORAGE), []);
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
  window.localStorage.setItem(WORKSPACES_STORAGE, JSON.stringify(all.slice(-40)));
}

export function deleteLocalWorkspace(id: string): void {
  if (typeof window === "undefined") return;
  const all = listLocalWorkspaces().filter((item) => item.id !== id);
  window.localStorage.setItem(WORKSPACES_STORAGE, JSON.stringify(all));
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_STORAGE);
}

export function setActiveWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_STORAGE, id);
}

export function getStoredTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(THEME_STORAGE);
  return value === "light" || value === "dark" ? value : null;
}

export function storeTheme(theme: "light" | "dark"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE, theme);
}

export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_STORAGE) === "1";
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_STORAGE, "1");
}

export function listLocalHistory(): CalculationRecord[] {
  if (typeof window === "undefined") return [];
  return safeParse<CalculationRecord[]>(
    window.localStorage.getItem(LOCAL_HISTORY_STORAGE),
    [],
  ).map((item) => ({ ...item, storage: "local" as const }));
}

export function appendLocalHistory(record: Omit<CalculationRecord, "id" | "storage">): CalculationRecord {
  const entry: CalculationRecord = { ...record, id: nanoid(10), storage: "local" };
  if (typeof window === "undefined") return entry;
  const all = [entry, ...listLocalHistory()].slice(0, 100);
  window.localStorage.setItem(LOCAL_HISTORY_STORAGE, JSON.stringify(all));
  return entry;
}

export function clearLocalHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_HISTORY_STORAGE);
}

// ---------------------------------------------------------------- cloud API

export interface CloudWorkspaceDto {
  id: string;
  name: string;
  description: string;
  isTemplate: boolean;
  data: WorkspaceData;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-owner-key": getOwnerKey(),
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }
  return payload as T;
}

export async function fetchCloudWorkspaces(): Promise<CloudWorkspaceDto[]> {
  const result = await request<{ workspaces: CloudWorkspaceDto[] }>("/api/workspaces");
  return result.workspaces;
}

export async function createCloudWorkspace(
  name: string,
  description: string,
  data: WorkspaceData,
): Promise<CloudWorkspaceDto> {
  const result = await request<{ workspace: CloudWorkspaceDto }>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, description, data }),
  });
  return result.workspace;
}

export async function updateCloudWorkspace(
  id: string,
  payload: { name?: string; description?: string; data?: WorkspaceData },
): Promise<CloudWorkspaceDto> {
  const result = await request<{ workspace: CloudWorkspaceDto }>(`/api/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return result.workspace;
}

export async function deleteCloudWorkspace(id: string): Promise<void> {
  await request(`/api/workspaces/${id}`, { method: "DELETE" });
}

export async function fetchCloudHistory(): Promise<CalculationRecord[]> {
  const result = await request<{ calculations: Omit<CalculationRecord, "storage">[] }>(
    "/api/calculations",
  );
  return result.calculations.map((item) => ({ ...item, storage: "cloud" as const }));
}

export async function saveCloudCalculation(payload: {
  kind: string;
  expression: string;
  result: string;
}): Promise<CalculationRecord> {
  const response = await request<{ calculation: Omit<CalculationRecord, "storage"> }>(
    "/api/calculations",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return { ...response.calculation, storage: "cloud" };
}

export async function clearCloudHistory(): Promise<void> {
  await request("/api/calculations", { method: "DELETE" });
}
