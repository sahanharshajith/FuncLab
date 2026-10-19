import { describe, expect, it } from "vitest";
import {
  compileWorkspace,
  evaluateWorkspace,
  makeEvaluator,
} from "@/lib/math/workspace-eval";
import { createFunction, createVariable, demoWorkspace } from "@/lib/workspace/defaults";
import { detectWorkspaceVariables, syncVariables, workspaceReducer } from "@/lib/workspace/reducer";
import { coerceWorkspaceData, workspaceExportSchema } from "@/lib/workspace/schema";
import type { FunctionDef, VariableConfig } from "@/lib/types";

const vars = (entries: Record<string, number>): VariableConfig[] =>
  Object.entries(entries).map(([name, value]) => createVariable(name, { value }));

describe("multiple functions and shared variables", () => {
  const functions: FunctionDef[] = [
    createFunction("f(x)", "x^2 + 2*x + 1"),
    createFunction("g(x)", "sin(x)"),
    createFunction("h(x)", "f(x) + g(x)"),
  ];

  it("evaluates every function with a shared variable value", () => {
    const compiled = compileWorkspace(functions);
    const results = evaluateWorkspace(compiled, vars({ x: 2 }), "rad");
    expect(results[0].value).toBe(9);
    expect(results[1].value).toBeCloseTo(Math.sin(2));
    expect(results[2].value).toBeCloseTo(9 + Math.sin(2));
    expect(results[2].dependencies.sort()).toEqual(["f", "g"]);
  });

  it("supports per-function overrides of a shared variable", () => {
    const withOverride = [
      functions[0],
      { ...functions[1], overrides: { x: 0 } },
      functions[2],
    ];
    const compiled = compileWorkspace(withOverride);
    const results = evaluateWorkspace(compiled, vars({ x: 2 }), "rad");
    expect(results[1].value).toBe(0);
    expect(results[0].value).toBe(9);
  });

  it("keeps other functions working when one is invalid", () => {
    const compiled = compileWorkspace([
      createFunction("f(x)", "x^2"),
      createFunction("bad(x)", "x +"),
    ]);
    const results = evaluateWorkspace(compiled, vars({ x: 3 }), "rad");
    expect(results[0].value).toBe(9);
    expect(results[1].error).toBeTruthy();
    expect(results[1].status).toBe("error");
  });

  it("marks disabled functions without evaluating them", () => {
    const compiled = compileWorkspace([createFunction("f(x)", "x^2", { enabled: false })]);
    const results = evaluateWorkspace(compiled, vars({ x: 3 }), "rad");
    expect(results[0].status).toBe("disabled");
    expect(results[0].value).toBeNull();
  });

  it("applies the angle mode to every function", () => {
    const compiled = compileWorkspace([createFunction("g(x)", "sin(x)")]);
    const degrees = evaluateWorkspace(compiled, vars({ x: 90 }), "deg");
    expect(degrees[0].value).toBeCloseTo(1);
  });
});

describe("dependency resolution", () => {
  it("detects direct circular references", () => {
    const compiled = compileWorkspace([
      createFunction("f(x)", "g(x) + 1"),
      createFunction("g(x)", "f(x) + 1"),
    ]);
    const results = evaluateWorkspace(compiled, vars({ x: 1 }), "rad");
    expect(results[0].error).toMatch(/Circular dependency/i);
    expect(results.some((item) => item.error?.includes("→"))).toBe(true);
  });

  it("detects self references", () => {
    const compiled = compileWorkspace([createFunction("f(x)", "f(x) + 1")]);
    expect(compiled.functions[0].error).toMatch(/itself/i);
  });

  it("explains when a dependency is broken", () => {
    const compiled = compileWorkspace([
      createFunction("f(x)", "x +"),
      createFunction("h(x)", "f(x) * 2"),
    ]);
    expect(compiled.byName.get("h")?.error).toMatch(/has an error/);
  });
});

describe("single variable evaluators", () => {
  it("keeps other variables fixed when graphing against one variable", () => {
    const compiled = compileWorkspace([createFunction("q(x, y)", "x^2 + y")]);
    const evaluate = makeEvaluator(compiled, compiled.functions[0].id, "x", {
      angleMode: "rad",
      values: { x: 0, y: 3 },
    });
    expect(evaluate).not.toBeNull();
    expect(evaluate?.(2)).toBe(7);
    expect(evaluate?.(-2)).toBe(7);
  });

  it("returns null outside the domain", () => {
    const compiled = compileWorkspace([createFunction("p(x)", "sqrt(x - 2)")]);
    const evaluate = makeEvaluator(compiled, compiled.functions[0].id, "x", {
      angleMode: "rad",
      values: { x: 0 },
    });
    expect(evaluate?.(1)).toBeNull();
    expect(evaluate?.(6)).toBe(2);
  });
});

describe("workspace reducer", () => {
  it("creates shared variables for newly detected names and preserves values", () => {
    const workspace = demoWorkspace();
    const withValue = workspaceReducer(workspace, {
      type: "update-variable",
      name: "x",
      patch: { value: 7 },
    });
    const updated = workspaceReducer(withValue, {
      type: "update-function",
      id: withValue.data.functions[0].id,
      patch: { expression: "x^2 + alpha" },
    });
    expect(updated.data.variables.find((item) => item.name === "alpha")).toBeDefined();
    expect(updated.data.variables.find((item) => item.name === "x")?.value).toBe(7);
  });

  it("adds, duplicates, reorders and removes functions", () => {
    let workspace = demoWorkspace();
    const count = workspace.data.functions.length;
    workspace = workspaceReducer(workspace, { type: "add-function" });
    expect(workspace.data.functions).toHaveLength(count + 1);

    const first = workspace.data.functions[0];
    workspace = workspaceReducer(workspace, { type: "duplicate-function", id: first.id });
    expect(workspace.data.functions[1].signature).not.toBe(first.signature);

    workspace = workspaceReducer(workspace, { type: "move-function", id: first.id, direction: 1 });
    expect(workspace.data.functions[1].id).toBe(first.id);

    workspace = workspaceReducer(workspace, { type: "remove-function", id: first.id });
    expect(workspace.data.functions.find((fn) => fn.id === first.id)).toBeUndefined();
  });

  it("stores and clears per-function overrides", () => {
    let workspace = demoWorkspace();
    const target = workspace.data.functions[0];
    workspace = workspaceReducer(workspace, {
      type: "set-override",
      id: target.id,
      variable: "x",
      value: 5,
    });
    expect(workspace.data.functions[0].overrides.x).toBe(5);
    workspace = workspaceReducer(workspace, {
      type: "set-override",
      id: target.id,
      variable: "x",
      value: null,
    });
    expect(workspace.data.functions[0].overrides.x).toBeUndefined();
  });

  it("resets variables to their default values", () => {
    let workspace = demoWorkspace();
    workspace = workspaceReducer(workspace, {
      type: "update-variable",
      name: "x",
      patch: { value: 99 },
    });
    workspace = workspaceReducer(workspace, { type: "reset-variables" });
    expect(workspace.data.variables.find((item) => item.name === "x")?.value).toBe(2);
  });

  it("detects workspace variables while ignoring function names", () => {
    const names = detectWorkspaceVariables([
      createFunction("f(x)", "x^2"),
      createFunction("h(x)", "f(x) + y"),
    ]);
    expect(names).toEqual(["x", "y"]);
  });

  it("syncs variables without dropping unused entries unexpectedly", () => {
    const data = syncVariables({
      ...demoWorkspace().data,
      functions: [createFunction("f(a)", "a*2")],
    });
    expect(data.variables.some((item) => item.name === "a")).toBe(true);
  });
});

describe("workspace persistence schemas", () => {
  it("round-trips an exported workspace", () => {
    const workspace = demoWorkspace();
    const payload = {
      kind: "funclab.workspace",
      name: workspace.name,
      description: workspace.description,
      data: workspace.data,
    };
    const parsed = workspaceExportSchema.safeParse(JSON.parse(JSON.stringify(payload)));
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(workspaceExportSchema.safeParse({ kind: "nope" }).success).toBe(false);
  });

  it("recovers defaults for partially invalid data", () => {
    const data = coerceWorkspaceData({ functions: [], variables: "oops" });
    expect(data.version).toBe(1);
    expect(data.variables).toEqual([]);
    expect(data.graph.mode).toBe("cartesian");
  });
});
