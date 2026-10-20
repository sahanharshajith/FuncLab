/**
 * Shared domain types for the FuncLab function calculator / graphing platform.
 * These types are used across the math engine, workspace state and persistence.
 */

export type AngleMode = "rad" | "deg";

export type NumberNotation = "auto" | "fixed" | "exponential";

export type GraphMode =
  | "cartesian"
  | "parametric"
  | "polar"
  | "implicit"
  | "surface"
  | "points";

export type ThemeMode = "light" | "dark";

/** A shared (workspace level) variable. */
export interface VariableConfig {
  id: string;
  name: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  useSlider: boolean;
}

/** One user defined function in the workspace. */
export interface FunctionDef {
  id: string;
  /** Raw signature text, e.g. `f(x)` or `g(x, y)`. */
  signature: string;
  /** Raw expression text, e.g. `x^2 + 2*x + 1`. */
  expression: string;
  color: string;
  /** Visible on the graph. */
  visible: boolean;
  /** Evaluated at all. */
  enabled: boolean;
  group: string;
  /** Function local overrides of shared variables: name -> value. */
  overrides: Record<string, number>;
  notes?: string;
}

export interface PlotPoint {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface GraphSettings {
  mode: GraphMode;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  autoY: boolean;
  samples: number;
  /** Variable mapped to the horizontal axis in cartesian mode. */
  axisVariable: string;
  showGrid: boolean;
  showLegend: boolean;
  theme: "auto" | "light" | "dark";
  lineWidth: number;
  /** Parametric mode */
  paramVariable: string;
  tMin: number;
  tMax: number;
  tSamples: number;
  parametricX: string | null;
  parametricY: string | null;
  /** Polar mode */
  polarFunction: string | null;
  polarVariable: string;
  /** Implicit mode: f(x, y) = level */
  implicitFunction: string | null;
  implicitLevel: number;
  implicitX: string;
  implicitY: string;
  /** Surface mode: z = f(x, y) */
  surfaceFunction: string | null;
  surfaceX: string;
  surfaceY: string;
  surfaceResolution: number;
  /** Point plotting */
  points: PlotPoint[];
  showPoints: boolean;
}

export interface TableSettings {
  variable: string;
  start: number;
  end: number;
  step: number;
  precision: number;
  notation: NumberNotation;
  functionIds: string[];
}

export interface WorkspaceSettings {
  angleMode: AngleMode;
  precision: number;
  notation: NumberNotation;
  autoCalculate: boolean;
}

export interface WorkspaceData {
  version: 1;
  functions: FunctionDef[];
  savedComparisons: SavedComparison[];
  variables: VariableConfig[];
  graph: GraphSettings;
  table: TableSettings;
  settings: WorkspaceSettings;
}

/** A saved set of function results for one user-entered variable value. */
export interface SavedComparison {
  id: string;
  createdAt: string;
  variable: string;
  inputValue: number;
  values: Record<string, number>;
  results: SavedComparisonResult[];
}

export interface SavedComparisonResult {
  functionId: string;
  signature: string;
  color: string;
  usedValues: Record<string, number>;
  value: number | null;
  display: string;
  error: string | null;
  status: EvaluationStatus;
}

export type WorkspaceStorageKind = "local";

export interface Workspace {
  id: string;
  name: string;
  description: string;
  storage: WorkspaceStorageKind;
  data: WorkspaceData;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string;
  storage: WorkspaceStorageKind;
  functionCount: number;
  updatedAt: string;
}

/** Parsed signature, e.g. `g(x, y)` -> { name: "g", params: ["x", "y"] } */
export interface ParsedSignature {
  name: string;
  params: string[];
  error: string | null;
}

export type EvaluationStatus = "ok" | "error" | "disabled";

export interface FunctionEvaluation {
  id: string;
  name: string;
  params: string[];
  /** Free variables detected in the expression (dependencies excluded). */
  variables: string[];
  /** Other workspace functions referenced by this function. */
  dependencies: string[];
  /** Resolved variable values actually used for the scalar evaluation. */
  usedValues: Record<string, number>;
  value: number | null;
  /** Human readable value (may be complex / Infinity / NaN). */
  display: string;
  error: string | null;
  status: EvaluationStatus;
}

export interface CalculationRecord {
  id: string;
  kind: string;
  expression: string;
  result: string;
  createdAt: string;
  storage: WorkspaceStorageKind;
}

export interface SampledSeries {
  x: number[];
  y: (number | null)[];
}
