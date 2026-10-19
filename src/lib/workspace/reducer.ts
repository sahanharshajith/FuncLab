import { nanoid } from "nanoid";
import type {
  FunctionDef,
  GraphSettings,
  PlotPoint,
  TableSettings,
  VariableConfig,
  Workspace,
  WorkspaceData,
  WorkspaceSettings,
} from "@/lib/types";
import { detectVariables, sortVariableNames } from "@/lib/math/engine";
import { parseSignature } from "@/lib/math/signature";
import { createFunction, createVariable, nextColor } from "./defaults";

export type WorkspaceAction =
  | { type: "replace"; workspace: Workspace }
  | { type: "set-meta"; name?: string; description?: string }
  | { type: "add-function"; preset?: Partial<FunctionDef> }
  | { type: "update-function"; id: string; patch: Partial<FunctionDef> }
  | { type: "remove-function"; id: string }
  | { type: "duplicate-function"; id: string }
  | { type: "move-function"; id: string; direction: -1 | 1 }
  | { type: "set-override"; id: string; variable: string; value: number | null }
  | { type: "update-variable"; name: string; patch: Partial<VariableConfig> }
  | { type: "reset-variables" }
  | { type: "remove-variable"; name: string }
  | { type: "prune-variables" }
  | { type: "update-graph"; patch: Partial<GraphSettings> }
  | { type: "update-table"; patch: Partial<TableSettings> }
  | { type: "update-settings"; patch: Partial<WorkspaceSettings> }
  | { type: "add-point"; point?: Partial<PlotPoint> }
  | { type: "update-point"; id: string; patch: Partial<PlotPoint> }
  | { type: "remove-point"; id: string }
  | { type: "set-data"; data: WorkspaceData };

const SUGGESTED_DEFAULTS: Record<string, Partial<VariableConfig>> = {
  x: { value: 1, min: -10, max: 10, step: 0.1 },
  y: { value: 1, min: -10, max: 10, step: 0.1 },
  z: { value: 1, min: -10, max: 10, step: 0.1 },
  t: { value: 0, min: 0, max: 10, step: 0.05 },
  theta: { value: 0, min: 0, max: 6.283185307179586, step: 0.01 },
  n: { value: 2, min: 0, max: 20, step: 1 },
};

/** Variables referenced by the workspace functions (best effort, never throws). */
export function detectWorkspaceVariables(functions: FunctionDef[]): string[] {
  const names = new Set(
    functions
      .map((fn) => parseSignature(fn.signature).name)
      .filter((name): name is string => Boolean(name)),
  );
  const variables = new Set<string>();
  for (const fn of functions) {
    const signature = parseSignature(fn.signature);
    signature.params.forEach((param) => variables.add(param));
    try {
      const detection = detectVariables(fn.expression, {
        declaredParams: signature.params,
        knownFunctions: names,
      });
      detection.variables.forEach((name) => variables.add(name));
    } catch {
      // Invalid expressions simply contribute no new variables.
    }
  }
  return [...variables].sort(sortVariableNames);
}

/** Add missing shared variables, keep existing values (never drop user input). */
export function syncVariables(data: WorkspaceData): WorkspaceData {
  const detected = detectWorkspaceVariables(data.functions);
  const existing = new Map(data.variables.map((variable) => [variable.name, variable]));
  const result: VariableConfig[] = [...data.variables];

  for (const name of detected) {
    if (existing.has(name)) continue;
    result.push(createVariable(name, SUGGESTED_DEFAULTS[name] ?? {}));
  }

  if (result.length === data.variables.length) return data;
  return { ...data, variables: result };
}

function touch(workspace: Workspace, data: WorkspaceData): Workspace {
  return { ...workspace, data, updatedAt: new Date().toISOString() };
}

export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case "replace":
      return { ...action.workspace, data: syncVariables(action.workspace.data) };

    case "set-data":
      return touch(state, syncVariables(action.data));

    case "set-meta":
      return {
        ...state,
        name: action.name ?? state.name,
        description: action.description ?? state.description,
        updatedAt: new Date().toISOString(),
      };

    case "add-function": {
      const used = state.data.functions.map((fn) => fn.color);
      const letters = "fghpqrsuvw";
      const usedNames = new Set(
        state.data.functions.map((fn) => parseSignature(fn.signature).name),
      );
      const letter = letters.split("").find((char) => !usedNames.has(char)) ?? `f${state.data.functions.length + 1}`;
      const fn = createFunction(
        action.preset?.signature ?? `${letter}(x)`,
        action.preset?.expression ?? "",
        { color: nextColor(used), ...action.preset },
      );
      return touch(state, syncVariables({
        ...state.data,
        functions: [...state.data.functions, fn],
      }));
    }

    case "update-function": {
      const functions = state.data.functions.map((fn) =>
        fn.id === action.id ? { ...fn, ...action.patch } : fn,
      );
      return touch(state, syncVariables({ ...state.data, functions }));
    }

    case "remove-function": {
      const functions = state.data.functions.filter((fn) => fn.id !== action.id);
      const graph = { ...state.data.graph };
      (["parametricX", "parametricY", "polarFunction", "implicitFunction", "surfaceFunction"] as const)
        .forEach((key) => {
          if (graph[key] === action.id) graph[key] = null;
        });
      return touch(state, {
        ...state.data,
        functions,
        graph,
        table: {
          ...state.data.table,
          functionIds: state.data.table.functionIds.filter((id) => id !== action.id),
        },
      });
    }

    case "duplicate-function": {
      const index = state.data.functions.findIndex((fn) => fn.id === action.id);
      if (index === -1) return state;
      const source = state.data.functions[index];
      const parsed = parseSignature(source.signature);
      const usedNames = new Set(
        state.data.functions.map((fn) => parseSignature(fn.signature).name),
      );
      let name = `${parsed.name}2`;
      let counter = 2;
      while (usedNames.has(name)) {
        counter += 1;
        name = `${parsed.name}${counter}`;
      }
      const copy: FunctionDef = {
        ...source,
        id: nanoid(10),
        signature: parsed.params.length ? `${name}(${parsed.params.join(", ")})` : name,
        color: nextColor(state.data.functions.map((fn) => fn.color)),
        overrides: { ...source.overrides },
      };
      const functions = [...state.data.functions];
      functions.splice(index + 1, 0, copy);
      return touch(state, { ...state.data, functions });
    }

    case "move-function": {
      const index = state.data.functions.findIndex((fn) => fn.id === action.id);
      const target = index + action.direction;
      if (index === -1 || target < 0 || target >= state.data.functions.length) return state;
      const functions = [...state.data.functions];
      const [item] = functions.splice(index, 1);
      functions.splice(target, 0, item);
      return touch(state, { ...state.data, functions });
    }

    case "set-override": {
      const functions = state.data.functions.map((fn) => {
        if (fn.id !== action.id) return fn;
        const overrides = { ...fn.overrides };
        if (action.value === null) delete overrides[action.variable];
        else overrides[action.variable] = action.value;
        return { ...fn, overrides };
      });
      return touch(state, { ...state.data, functions });
    }

    case "update-variable": {
      const variables = state.data.variables.map((variable) =>
        variable.name === action.name ? { ...variable, ...action.patch } : variable,
      );
      return touch(state, { ...state.data, variables });
    }

    case "reset-variables": {
      const variables = state.data.variables.map((variable) => ({
        ...variable,
        value: variable.defaultValue,
      }));
      return touch(state, { ...state.data, variables });
    }

    case "remove-variable": {
      const variables = state.data.variables.filter((variable) => variable.name !== action.name);
      return touch(state, { ...state.data, variables });
    }

    case "prune-variables": {
      const used = new Set(detectWorkspaceVariables(state.data.functions));
      const variables = state.data.variables.filter((variable) => used.has(variable.name));
      return touch(state, { ...state.data, variables });
    }

    case "update-graph":
      return touch(state, { ...state.data, graph: { ...state.data.graph, ...action.patch } });

    case "update-table":
      return touch(state, { ...state.data, table: { ...state.data.table, ...action.patch } });

    case "update-settings":
      return touch(state, { ...state.data, settings: { ...state.data.settings, ...action.patch } });

    case "add-point": {
      const point: PlotPoint = {
        id: nanoid(8),
        x: action.point?.x ?? 0,
        y: action.point?.y ?? 0,
        label: action.point?.label ?? `P${state.data.graph.points.length + 1}`,
      };
      return touch(state, {
        ...state.data,
        graph: { ...state.data.graph, points: [...state.data.graph.points, point] },
      });
    }

    case "update-point": {
      const points = state.data.graph.points.map((point) =>
        point.id === action.id ? { ...point, ...action.patch } : point,
      );
      return touch(state, { ...state.data, graph: { ...state.data.graph, points } });
    }

    case "remove-point": {
      const points = state.data.graph.points.filter((point) => point.id !== action.id);
      return touch(state, { ...state.data, graph: { ...state.data.graph, points } });
    }

    default:
      return state;
  }
}
