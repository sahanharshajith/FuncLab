"use client";

import { useMemo, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { BookmarkPlus, FunctionSquare, Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/math/format";
import { evaluateWorkspace } from "@/lib/math/workspace-eval";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  NumberInput,
  PanelHeading,
  Spinner,
  cn,
} from "@/components/ui/primitives";
import { FunctionCard } from "./function-card";
import { VariablesPanel } from "./variables-panel";

const QUICK_ADD = [
  { signature: "f(x)", expression: "x^2" },
  { signature: "g(x)", expression: "sin(x)" },
  { signature: "h(x, y)", expression: "x^2 + y^2" },
  { signature: "p(x)", expression: "sqrt(x - 2)" },
  { signature: "q(x)", expression: "1/(x - 1)" },
  { signature: "r(a, b)", expression: "a*b + log(b)" },
  { signature: "s(x)", expression: "2x + 3" },
];

export function FunctionsView() {
  const { workspace, dispatch, evaluationById, compiled, calculating, values } = useWorkspaceStore();
  const { functions, variables, settings, graph } = workspace.data;
  const [comparisonInput, setComparisonInput] = useState<number | null>(null);
  const comparisonValue = comparisonInput ?? values[graph.axisVariable] ?? 0;

  const comparisonVariables = useMemo(
    () => variables.map((variable) =>
      variable.name === graph.axisVariable
        ? { ...variable, value: comparisonValue }
        : variable,
    ),
    [variables, graph.axisVariable, comparisonValue],
  );
  const comparisonEvaluations = useMemo(
    () => evaluateWorkspace(compiled, comparisonVariables, settings.angleMode),
    [compiled, comparisonVariables, settings.angleMode],
  );
  const comparisonEvaluationById = useMemo(
    () => new Map(comparisonEvaluations.map((item) => [item.id, item])),
    [comparisonEvaluations],
  );

  const variableMap = useMemo(
    () => new Map(variables.map((variable) => [variable.name, variable])),
    [variables],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof functions>();
    for (const fn of functions) {
      const key = fn.group?.trim() || "General";
      map.set(key, [...(map.get(key) ?? []), fn]);
    }
    return [...map.entries()];
  }, [functions]);

  const errorCount = functions.filter((fn) => evaluationById.get(fn.id)?.error).length;

  const saveComparison = () => {
    const valuesAtInput = Object.fromEntries(
      comparisonVariables.map((variable) => [variable.name, variable.value]),
    );

    dispatch({
      type: "save-comparison",
      comparison: {
        variable: graph.axisVariable,
        inputValue: comparisonValue,
        values: valuesAtInput,
        results: comparisonEvaluations.flatMap((result) => {
          const fn = functions.find((item) => item.id === result.id);
          return fn
            ? [{
                functionId: fn.id,
                signature: fn.signature,
                color: fn.color,
                usedValues: result.usedValues,
                value: result.value,
                display: result.display,
                error: result.error,
                status: result.status,
              }]
            : [];
        }),
      },
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <Card>
          <PanelHeading
            title="Function editor"
            description="Variables are detected automatically — constants (pi, e) and built-ins (sin, log…) are never treated as variables."
            actions={
              <>
                {calculating ? (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Spinner /> calculating…
                  </span>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => dispatch({ type: "add-function" })}>
                  + Add function
                </Button>
              </>
            }
          />
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Quick add:</span>
            {QUICK_ADD.map((item) => (
              <button
                key={item.signature + item.expression}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "add-function",
                    preset: { signature: item.signature, expression: item.expression },
                  })
                }
                className="mono rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300"
              >
                {item.signature} = {item.expression}
              </button>
            ))}
          </div>
        </Card>

        {errorCount > 0 ? (
          <Alert tone="warning">
            {errorCount} function{errorCount > 1 ? "s have" : " has"} an error. Other functions keep
            working — fix the highlighted cards to restore them.
          </Alert>
        ) : null}

        {functions.length === 0 ? (
          <EmptyState
            icon={<FunctionSquare size={22} aria-hidden="true" />}
            title="No functions yet"
            description="Create your first function to start calculating. Try f(x) = x^2 + 2*x + 1 — the variable x is detected automatically."
            action={
              <Button
                variant="primary"
                onClick={() =>
                  dispatch({
                    type: "add-function",
                    preset: { signature: "f(x)", expression: "x^2 + 2*x + 1" },
                  })
                }
              >
                Create my first function
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map(([group, groupFunctions]) => (
              <div key={group} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group}
                  </h3>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <Badge tone="neutral">{groupFunctions.length}</Badge>
                </div>
                <div className="space-y-3">
                  {groupFunctions.map((fn) => (
                    <FunctionCard
                      key={fn.id}
                      def={fn}
                      evaluation={evaluationById.get(fn.id)}
                      variables={variableMap}
                      settings={settings}
                      index={functions.indexOf(fn)}
                      total={functions.length}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <VariablesPanel
          variables={variables}
          usedVariables={compiled.allVariables}
          axisVariable={graph.axisVariable}
          dispatch={dispatch}
        />

        <Card>
          <PanelHeading
            title="Results comparison"
            description="Compare functions at a chosen value and save results to review later in this session."
          />
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <label
                htmlFor="comparison-input"
                className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Compare at {graph.axisVariable} =
              </label>
              <NumberInput
                id="comparison-input"
                ariaLabel={`Comparison value for ${graph.axisVariable}`}
                value={comparisonValue}
                onCommit={setComparisonInput}
                className="h-8 w-32"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!functions.length || calculating}
              onClick={saveComparison}
            >
              <BookmarkPlus size={15} aria-hidden="true" />
              Save comparison
            </Button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Other variable values stay as currently set.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Function</th>
                  <th scope="col" className="px-3 py-2 font-medium">Inputs</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {functions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                      Nothing to compare yet.
                    </td>
                  </tr>
                ) : null}
                {functions.map((fn) => {
                  const evaluation = comparisonEvaluationById.get(fn.id);
                  return (
                    <tr key={fn.id} className="align-top">
                      <td className="px-3 py-2">
                        <span className="mono flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: fn.color }}
                            aria-hidden
                          />
                          {fn.signature}
                        </span>
                      </td>
                      <td className="mono px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {evaluation && evaluation.variables.length
                          ? evaluation.variables
                              .map(
                                (name) =>
                                  `${name}=${formatNumber(evaluation.usedValues[name], 4, "auto")}`,
                              )
                              .join(", ")
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "mono px-3 py-2 text-right font-semibold",
                          evaluation?.error
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-900 dark:text-slate-100",
                        )}
                      >
                        {evaluation?.status === "disabled"
                          ? "off"
                          : evaluation?.error
                            ? "error"
                            : formatNumber(
                                evaluation?.value ?? null,
                                settings.precision,
                                settings.notation,
                              )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Saved comparisons
              </h3>
              <Badge tone="neutral">{workspace.data.savedComparisons.length}</Badge>
            </div>
            {workspace.data.savedComparisons.length ? (
              <div className="max-h-96 space-y-3 overflow-y-auto px-3 pb-3">
                {[...workspace.data.savedComparisons].reverse().map((comparison) => (
                  <div
                    key={comparison.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {comparison.variable} = {formatNumber(comparison.inputValue, settings.precision, settings.notation)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {Object.entries(comparison.values)
                            .filter(([name]) => name !== comparison.variable)
                            .map(([name, value]) => `${name}=${formatNumber(value, 4, "auto")}`)
                            .join(", ") || "No other variable values"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete comparison for ${comparison.variable} = ${formatNumber(comparison.inputValue, 4)}`}
                        title="Delete saved comparison"
                        onClick={() => dispatch({ type: "remove-comparison", id: comparison.id })}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 dark:text-slate-400">
                          <tr>
                            <th scope="col" className="px-3 py-1.5 font-medium">Function</th>
                            <th scope="col" className="px-3 py-1.5 font-medium">Inputs</th>
                            <th scope="col" className="px-3 py-1.5 text-right font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {comparison.results.map((result) => (
                            <tr key={result.functionId}>
                              <td className="px-3 py-1.5">
                                <span className="mono flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: result.color }} aria-hidden="true" />
                                  {result.signature}
                                </span>
                              </td>
                              <td className="mono px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                {Object.entries(result.usedValues)
                                  .map(([name, value]) => `${name}=${formatNumber(value, 4, "auto")}`)
                                  .join(", ") || "—"}
                              </td>
                              <td className={cn(
                                "mono px-3 py-1.5 text-right font-semibold",
                                result.status === "error" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100",
                              )}>
                                {result.status === "disabled" ? "off" : result.error ? "error" : result.display}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-3 pb-3 text-xs text-slate-500 dark:text-slate-400">
                No saved comparisons yet. Enter a value above and choose Save comparison.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
