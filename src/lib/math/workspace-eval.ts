/**
 * Compiles a whole workspace of functions:
 *  - parses signatures and expressions
 *  - detects variables per function
 *  - resolves references between functions (h(x) = f(x) + g(x))
 *  - detects circular dependencies
 *  - provides fast evaluators used by the graph and the table
 */
import type {
  AngleMode,
  FunctionDef,
  FunctionEvaluation,
  VariableConfig,
} from "@/lib/types";
import {
  ExpressionError,
  buildScope,
  compileExpression,
  detectVariables,
  evaluateCompiled,
  friendlyEvaluationError,
  sortVariableNames,
  toRealNumber,
  type CompiledExpression,
} from "./engine";
import { parseSignature } from "./signature";

const MAX_CALL_DEPTH = 24;

export interface CompiledFunction {
  id: string;
  def: FunctionDef;
  name: string;
  params: string[];
  /** Variables the UI should ask the user for (params first, then detected extras). */
  variables: string[];
  dependencies: string[];
  compiled: CompiledExpression | null;
  error: string | null;
  cycle: string[] | null;
}

export interface CompiledWorkspace {
  functions: CompiledFunction[];
  byId: Map<string, CompiledFunction>;
  byName: Map<string, CompiledFunction>;
  /** Union of all variables used by enabled functions. */
  allVariables: string[];
}

export function compileWorkspace(functions: FunctionDef[]): CompiledWorkspace {
  const signatures = functions.map((def) => ({ def, sig: parseSignature(def.signature) }));
  const knownNames = new Set(
    signatures.map(({ sig }) => sig.name).filter((name): name is string => Boolean(name)),
  );

  const compiledList: CompiledFunction[] = signatures.map(({ def, sig }) => {
    const base: CompiledFunction = {
      id: def.id,
      def,
      name: sig.name,
      params: sig.params,
      variables: [],
      dependencies: [],
      compiled: null,
      error: sig.error,
      cycle: null,
    };

    if (sig.error) return base;

    const others = new Set(knownNames);
    others.delete(sig.name);

    try {
      const detection = detectVariables(def.expression, {
        declaredParams: sig.params,
        knownFunctions: new Set([...knownNames]),
      });
      const detected = detection.variables.filter((name) => !sig.params.includes(name));
      base.variables = [...sig.params, ...detected.sort(sortVariableNames)];
      base.dependencies = detection.dependencies.filter((name) => name !== sig.name);
      if (detection.dependencies.includes(sig.name)) {
        base.cycle = [sig.name, sig.name];
        base.error = `Circular dependency: ${sig.name} refers to itself.`;
        return base;
      }
      base.compiled = compileExpression(def.expression);
    } catch (error) {
      base.error =
        error instanceof ExpressionError
          ? error.message
          : friendlyEvaluationError(error);
    }
    return base;
  });

  // ---- circular dependency detection -------------------------------------
  const byName = new Map<string, CompiledFunction>();
  for (const fn of compiledList) {
    if (fn.name && !byName.has(fn.name)) byName.set(fn.name, fn);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  const visit = (name: string): string[] | null => {
    const current = state.get(name);
    if (current === "done") return null;
    if (current === "visiting") {
      const start = stack.indexOf(name);
      return [...stack.slice(start === -1 ? 0 : start), name];
    }
    const fn = byName.get(name);
    if (!fn) return null;
    state.set(name, "visiting");
    stack.push(name);
    for (const dep of fn.dependencies) {
      const cycle = visit(dep);
      if (cycle) {
        stack.pop();
        state.set(name, "done");
        return cycle;
      }
    }
    stack.pop();
    state.set(name, "done");
    return null;
  };

  for (const fn of compiledList) {
    if (!fn.name || fn.cycle) continue;
    state.clear();
    stack.length = 0;
    const cycle = visit(fn.name);
    if (cycle && cycle.includes(fn.name)) {
      fn.cycle = cycle;
      fn.error = `Circular dependency detected: ${cycle.join(" → ")}. Remove one of the references.`;
    }
  }

  // Functions depending on a broken function inherit a clear message.
  for (const fn of compiledList) {
    if (fn.error) continue;
    for (const dep of fn.dependencies) {
      const target = byName.get(dep);
      if (target && (target.error || target.cycle)) {
        fn.error = `Depends on "${dep}" which currently has an error.`;
        break;
      }
      if (target && target.def.enabled === false) {
        fn.error = `Depends on "${dep}" which is disabled.`;
        break;
      }
    }
  }

  const allVariables = new Set<string>();
  for (const fn of compiledList) {
    if (fn.def.enabled === false) continue;
    fn.variables.forEach((name) => allVariables.add(name));
  }

  return {
    functions: compiledList,
    byId: new Map(compiledList.map((fn) => [fn.id, fn])),
    byName,
    allVariables: [...allVariables].sort(sortVariableNames),
  };
}

export function variableValueMap(variables: VariableConfig[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const variable of variables) map[variable.name] = variable.value;
  return map;
}

export interface ScopeOptions {
  angleMode: AngleMode;
  /** Shared variable values. */
  values: Record<string, number>;
}

/**
 * Creates a mutable evaluation scope that also exposes every valid workspace
 * function as a callable (so `h(x) = f(x) + g(x)` works).
 */
export function createWorkspaceScope(
  workspace: CompiledWorkspace,
  options: ScopeOptions,
): Record<string, unknown> {
  const scope = buildScope({ ...options.values }, options.angleMode);
  let depth = 0;

  for (const fn of workspace.functions) {
    if (!fn.name || !fn.compiled || fn.cycle) continue;
    const compiled = fn.compiled;
    const params = fn.params;
    const overrides = fn.def.overrides ?? {};
    scope[fn.name] = (...args: unknown[]) => {
      if (depth >= MAX_CALL_DEPTH) {
        throw new ExpressionError(
          "Maximum function nesting depth reached (possible infinite recursion).",
          "recursion",
        );
      }
      depth += 1;
      try {
        const local: Record<string, unknown> = { ...scope };
        for (const [key, value] of Object.entries(overrides)) {
          if (!params.includes(key)) local[key] = value;
        }
        params.forEach((param, index) => {
          if (index < args.length) local[param] = args[index];
        });
        return compiled.evaluate(local);
      } finally {
        depth -= 1;
      }
    };
  }

  return scope;
}

/** Resolve the value used for a variable inside one function. */
export function resolveValue(
  fn: CompiledFunction,
  variable: string,
  values: Record<string, number>,
): number {
  const override = fn.def.overrides?.[variable];
  if (typeof override === "number" && Number.isFinite(override)) return override;
  const shared = values[variable];
  return typeof shared === "number" && Number.isFinite(shared) ? shared : 0;
}

/** Evaluate every function once, using shared variables and per-function overrides. */
export function evaluateWorkspace(
  workspace: CompiledWorkspace,
  variables: VariableConfig[],
  angleMode: AngleMode,
): FunctionEvaluation[] {
  const values = variableValueMap(variables);
  const scope = createWorkspaceScope(workspace, { angleMode, values });

  return workspace.functions.map((fn) => {
    const usedValues: Record<string, number> = {};
    for (const variable of fn.variables) {
      usedValues[variable] = resolveValue(fn, variable, values);
    }

    const base: FunctionEvaluation = {
      id: fn.id,
      name: fn.name,
      params: fn.params,
      variables: fn.variables,
      dependencies: fn.dependencies,
      usedValues,
      value: null,
      display: "—",
      error: fn.error,
      status: fn.def.enabled === false ? "disabled" : fn.error ? "error" : "ok",
    };

    if (fn.def.enabled === false) return base;
    if (fn.error || !fn.compiled) return { ...base, status: "error" };

    const localScope: Record<string, unknown> = { ...scope, ...usedValues };
    const outcome = evaluateCompiled(fn.compiled, localScope);
    return {
      ...base,
      value: outcome.value,
      display: outcome.display,
      error: outcome.error,
      status: outcome.error && outcome.value === null ? "error" : "ok",
    };
  });
}

export interface EvaluatorOptions {
  angleMode: AngleMode;
  values: Record<string, number>;
}

/** Build a fast single-variable evaluator (used for graphs and tables). */
export function makeEvaluator(
  workspace: CompiledWorkspace,
  functionId: string,
  variable: string,
  options: EvaluatorOptions,
): ((input: number) => number | null) | null {
  const fn = workspace.byId.get(functionId);
  if (!fn || !fn.compiled || fn.error) return null;
  const scope = createWorkspaceScope(workspace, options);
  // Apply function-local overrides for fixed parameters.
  for (const [key, value] of Object.entries(fn.def.overrides ?? {})) {
    if (key !== variable) scope[key] = value;
  }
  const compiled = fn.compiled;
  return (input: number) => {
    scope[variable] = input;
    try {
      const value = toRealNumber(compiled.evaluate(scope));
      if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return null;
      return value;
    } catch {
      return null;
    }
  };
}

/** Build a fast two-variable evaluator (implicit curves and 3D surfaces). */
export function makeEvaluator2D(
  workspace: CompiledWorkspace,
  functionId: string,
  xVariable: string,
  yVariable: string,
  options: EvaluatorOptions,
): ((x: number, y: number) => number | null) | null {
  const fn = workspace.byId.get(functionId);
  if (!fn || !fn.compiled || fn.error) return null;
  const scope = createWorkspaceScope(workspace, options);
  for (const [key, value] of Object.entries(fn.def.overrides ?? {})) {
    if (key !== xVariable && key !== yVariable) scope[key] = value;
  }
  const compiled = fn.compiled;
  return (x: number, y: number) => {
    scope[xVariable] = x;
    scope[yVariable] = y;
    try {
      const value = toRealNumber(compiled.evaluate(scope));
      if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return null;
      return value;
    } catch {
      return null;
    }
  };
}

/** Standalone expression evaluator bound to the workspace scope (tools, calculator). */
export function makeExpressionEvaluator(
  workspace: CompiledWorkspace,
  expression: string,
  variable: string,
  options: EvaluatorOptions,
): ((input: number) => number | null) | null {
  let compiled: CompiledExpression;
  try {
    compiled = compileExpression(expression);
  } catch {
    return null;
  }
  const scope = createWorkspaceScope(workspace, options);
  return (input: number) => {
    scope[variable] = input;
    try {
      const value = toRealNumber(compiled.evaluate(scope));
      if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return null;
      return value;
    } catch {
      return null;
    }
  };
}
