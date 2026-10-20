import { nanoid } from "nanoid";
import type {
  FunctionDef,
  GraphSettings,
  TableSettings,
  VariableConfig,
  Workspace,
  WorkspaceData,
  WorkspaceSettings,
} from "@/lib/types";

export const FUNCTION_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];

export function nextColor(used: string[]): string {
  const available = FUNCTION_COLORS.find((color) => !used.includes(color));
  return available ?? FUNCTION_COLORS[used.length % FUNCTION_COLORS.length];
}

export function createVariable(
  name: string,
  overrides: Partial<VariableConfig> = {},
): VariableConfig {
  const value = overrides.value ?? 1;
  return {
    id: overrides.id ?? nanoid(8),
    name,
    value,
    defaultValue: overrides.defaultValue ?? value,
    min: overrides.min ?? -10,
    max: overrides.max ?? 10,
    step: overrides.step ?? 0.1,
    useSlider: overrides.useSlider ?? true,
  };
}

export function createFunction(
  signature: string,
  expression: string,
  overrides: Partial<FunctionDef> = {},
): FunctionDef {
  return {
    id: overrides.id ?? nanoid(10),
    signature,
    expression,
    color: overrides.color ?? FUNCTION_COLORS[0],
    visible: overrides.visible ?? true,
    enabled: overrides.enabled ?? true,
    group: overrides.group ?? "General",
    overrides: overrides.overrides ?? {},
    notes: overrides.notes,
  };
}

export function defaultGraphSettings(): GraphSettings {
  return {
    mode: "cartesian",
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
    autoY: true,
    samples: 800,
    axisVariable: "x",
    showGrid: true,
    showLegend: true,
    theme: "auto",
    lineWidth: 2.5,
    paramVariable: "t",
    tMin: 0,
    tMax: 6.283185307179586,
    tSamples: 800,
    parametricX: null,
    parametricY: null,
    polarFunction: null,
    polarVariable: "theta",
    implicitFunction: null,
    implicitLevel: 0,
    implicitX: "x",
    implicitY: "y",
    surfaceFunction: null,
    surfaceX: "x",
    surfaceY: "y",
    surfaceResolution: 60,
    points: [],
    showPoints: true,
  };
}

export function defaultTableSettings(): TableSettings {
  return {
    variable: "x",
    start: -5,
    end: 5,
    step: 1,
    precision: 6,
    notation: "auto",
    functionIds: [],
  };
}

export function defaultSettings(): WorkspaceSettings {
  return {
    angleMode: "rad",
    precision: 6,
    notation: "auto",
    autoCalculate: true,
  };
}

export function emptyWorkspaceData(): WorkspaceData {
  return {
    version: 1,
    functions: [],
    savedComparisons: [],
    variables: [],
    graph: defaultGraphSettings(),
    table: defaultTableSettings(),
    settings: defaultSettings(),
  };
}

/** Sample workspace used for the first-run experience. */
export function demoWorkspaceData(): WorkspaceData {
  const functions: FunctionDef[] = [
    createFunction("f(x)", "x^2 - 4", { color: FUNCTION_COLORS[0], group: "Polynomial" }),
    createFunction("g(x)", "sin(x)", { color: FUNCTION_COLORS[1], group: "Trigonometric" }),
    createFunction("h(x)", "exp(x)", {
      color: FUNCTION_COLORS[2],
      group: "Exponential",
      visible: false,
    }),
    createFunction("p(x)", "1/(x - 1)", { color: FUNCTION_COLORS[3], group: "Rational" }),
    createFunction("q(x, y)", "x^2 + y^2", {
      color: FUNCTION_COLORS[4],
      group: "Multivariable",
      visible: false,
    }),
  ];

  return {
    version: 1,
    functions,
    savedComparisons: [],
    variables: [
      createVariable("x", { value: 2, min: -10, max: 10, step: 0.1 }),
      createVariable("y", { value: 3, min: -10, max: 10, step: 0.1 }),
    ],
    graph: {
      ...defaultGraphSettings(),
      surfaceFunction: functions[4].id,
      implicitFunction: functions[4].id,
      implicitLevel: 25,
      polarFunction: functions[1].id,
    },
    table: defaultTableSettings(),
    settings: defaultSettings(),
  };
}

export function createWorkspace(
  name: string,
  data: WorkspaceData = emptyWorkspaceData(),
  storage: Workspace["storage"] = "local",
  description = "",
): Workspace {
  const now = new Date().toISOString();
  return {
    id: nanoid(12),
    name,
    description,
    storage,
    data,
    createdAt: now,
    updatedAt: now,
  };
}

export function demoWorkspace(): Workspace {
  return createWorkspace(
    "Getting started",
    demoWorkspaceData(),
    "local",
    "Sample functions covering polynomial, trigonometric, exponential, rational and multivariable cases.",
  );
}

export const STARTER_TEMPLATES: { name: string; description: string; build: () => WorkspaceData }[] = [
  {
    name: "Getting started",
    description: "Polynomial, trig, exponential, rational and multivariable samples.",
    build: demoWorkspaceData,
  },
  {
    name: "Calculus lab",
    description: "Functions tuned for derivative, integral and root exploration.",
    build: () => {
      const functions = [
        createFunction("f(x)", "x^3 - 3*x", { color: FUNCTION_COLORS[0], group: "Calculus" }),
        createFunction("g(x)", "cos(x) * exp(-x/4)", { color: FUNCTION_COLORS[1], group: "Calculus" }),
        createFunction("h(x)", "f(x) + g(x)", { color: FUNCTION_COLORS[2], group: "Composed" }),
      ];
      return {
        ...emptyWorkspaceData(),
        functions,
        variables: [createVariable("x", { value: 1, min: -6, max: 6, step: 0.05 })],
      };
    },
  },
  {
    name: "Physics parameters",
    description: "Projectile height with adjustable velocity and angle parameters.",
    build: () => {
      const functions = [
        createFunction("height(t)", "velocity*sin(theta)*t - 0.5*9.81*t^2", {
          color: FUNCTION_COLORS[0],
          group: "Kinematics",
        }),
        createFunction("range(t)", "velocity*cos(theta)*t", {
          color: FUNCTION_COLORS[1],
          group: "Kinematics",
        }),
      ];
      return {
        ...emptyWorkspaceData(),
        functions,
        variables: [
          createVariable("t", { value: 1, min: 0, max: 10, step: 0.05 }),
          createVariable("velocity", { value: 20, min: 0, max: 60, step: 0.5 }),
          createVariable("theta", { value: 0.785, min: 0, max: 1.5708, step: 0.01 }),
        ],
        graph: { ...defaultGraphSettings(), axisVariable: "t", xMin: 0, xMax: 5 },
        table: { ...defaultTableSettings(), variable: "t", start: 0, end: 4, step: 0.25 },
      };
    },
  },
];
