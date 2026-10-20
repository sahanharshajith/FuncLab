import { z } from "zod";
import {
  defaultGraphSettings,
  defaultSettings,
  defaultTableSettings,
} from "./defaults";
import type { WorkspaceData } from "@/lib/types";

const finiteNumber = z.number().finite();

export const variableSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  value: finiteNumber,
  defaultValue: finiteNumber,
  min: finiteNumber,
  max: finiteNumber,
  step: finiteNumber,
  useSlider: z.boolean(),
});

export const functionSchema = z.object({
  id: z.string().min(1).max(64),
  signature: z.string().min(1).max(120),
  expression: z.string().max(512),
  color: z.string().min(3).max(32),
  visible: z.boolean(),
  enabled: z.boolean(),
  group: z.string().max(64),
  overrides: z.record(z.string(), finiteNumber),
  notes: z.string().max(500).optional(),
});

export const savedComparisonResultSchema = z.object({
  functionId: z.string().min(1).max(64),
  signature: z.string().max(120),
  color: z.string().min(3).max(32),
  usedValues: z.record(z.string(), finiteNumber),
  value: finiteNumber.nullable(),
  display: z.string().max(200),
  error: z.string().max(500).nullable(),
  status: z.enum(["ok", "error", "disabled"]),
});

export const savedComparisonSchema = z.object({
  id: z.string().min(1).max(64),
  createdAt: z.string().max(64),
  variable: z.string().max(64),
  inputValue: finiteNumber,
  values: z.record(z.string(), finiteNumber),
  results: z.array(savedComparisonResultSchema).max(60),
});

export const pointSchema = z.object({
  id: z.string().min(1).max(64),
  x: finiteNumber,
  y: finiteNumber,
  label: z.string().max(64),
});

export const graphSchema = z.object({
  mode: z.enum(["cartesian", "parametric", "polar", "implicit", "surface", "points"]),
  xMin: finiteNumber,
  xMax: finiteNumber,
  yMin: finiteNumber,
  yMax: finiteNumber,
  autoY: z.boolean(),
  samples: z.number().int().min(25).max(4000),
  axisVariable: z.string().max(64),
  showGrid: z.boolean(),
  showLegend: z.boolean(),
  theme: z.enum(["auto", "light", "dark"]),
  lineWidth: z.number().min(0.5).max(8),
  paramVariable: z.string().max(64),
  tMin: finiteNumber,
  tMax: finiteNumber,
  tSamples: z.number().int().min(25).max(4000),
  parametricX: z.string().max(64).nullable(),
  parametricY: z.string().max(64).nullable(),
  polarFunction: z.string().max(64).nullable(),
  polarVariable: z.string().max(64),
  implicitFunction: z.string().max(64).nullable(),
  implicitLevel: finiteNumber,
  implicitX: z.string().max(64),
  implicitY: z.string().max(64),
  surfaceFunction: z.string().max(64).nullable(),
  surfaceX: z.string().max(64),
  surfaceY: z.string().max(64),
  surfaceResolution: z.number().int().min(10).max(160),
  points: z.array(pointSchema).max(500),
  showPoints: z.boolean(),
});

export const tableSchema = z.object({
  variable: z.string().max(64),
  start: finiteNumber,
  end: finiteNumber,
  step: finiteNumber,
  precision: z.number().int().min(0).max(15),
  notation: z.enum(["auto", "fixed", "exponential"]),
  functionIds: z.array(z.string().max(64)).max(100),
});

export const settingsSchema = z.object({
  angleMode: z.enum(["rad", "deg"]),
  precision: z.number().int().min(0).max(15),
  notation: z.enum(["auto", "fixed", "exponential"]),
  autoCalculate: z.boolean(),
});

export const workspaceDataSchema = z.object({
  version: z.literal(1),
  functions: z.array(functionSchema).max(60),
  savedComparisons: z.array(savedComparisonSchema).max(100).default([]),
  variables: z.array(variableSchema).max(120),
  graph: graphSchema,
  table: tableSchema,
  settings: settingsSchema,
});

export const workspaceExportSchema = z.object({
  kind: z.literal("funclab.workspace"),
  name: z.string().min(1).max(120),
  description: z.string().max(400).default(""),
  exportedAt: z.string().optional(),
  data: workspaceDataSchema,
});

export type WorkspaceExport = z.infer<typeof workspaceExportSchema>;

/**
 * Tolerant parse used when loading data from the current browser session or an imported file.
 * Missing/invalid sections fall back to defaults instead of destroying the file.
 */
export function coerceWorkspaceData(input: unknown): WorkspaceData {
  const parsed = workspaceDataSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  const raw = (input ?? {}) as Record<string, unknown>;
  const functions = z.array(functionSchema).safeParse(raw.functions);
  const variables = z.array(variableSchema).safeParse(raw.variables);
  const savedComparisons = z.array(savedComparisonSchema).max(100).safeParse(raw.savedComparisons);
  const graph = graphSchema.safeParse(raw.graph);
  const table = tableSchema.safeParse(raw.table);
  const settings = settingsSchema.safeParse(raw.settings);

  return {
    version: 1,
    functions: functions.success ? functions.data : [],
    savedComparisons: savedComparisons.success ? savedComparisons.data : [],
    variables: variables.success ? variables.data : [],
    graph: graph.success ? graph.data : defaultGraphSettings(),
    table: table.success ? table.data : defaultTableSettings(),
    settings: settings.success ? settings.data : defaultSettings(),
  };
}

