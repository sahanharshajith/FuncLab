"use client";

import { useMemo, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { Table2 } from "lucide-react";
import { useUi } from "@/lib/ui-context";
import { makeEvaluator } from "@/lib/math/workspace-eval";
import { generateTable, sortRows, tableToCsv, type SortDirection } from "@/lib/math/table";
import { formatNumber } from "@/lib/math/format";
import type { NumberNotation } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  NumberInput,
  PanelHeading,
  Select,
  cn,
} from "@/components/ui/primitives";

export function TableView() {
  const { workspace, dispatch, compiled, values } = useWorkspaceStore();
  const { inspectPoint } = useUi();
  const table = workspace.data.table;
  const settings = workspace.data.settings;
  const functions = workspace.data.functions;
  const [sortKey, setSortKey] = useState<string>("__input");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copied, setCopied] = useState(false);

  const selectedIds = table.functionIds.length
    ? table.functionIds
    : functions.filter((fn) => fn.enabled).map((fn) => fn.id);

  const result = useMemo(() => {
    const evaluators = selectedIds
      .map((id) => {
        const fn = functions.find((item) => item.id === id);
        if (!fn) return null;
        const compiledFn = compiled.byId.get(id);
        return {
          id,
          label: fn.signature,
          evaluate: makeEvaluator(compiled, id, table.variable, {
            angleMode: settings.angleMode,
            values,
          }),
          error: compiledFn?.error ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return generateTable(table.variable, table.start, table.end, table.step, evaluators);
  }, [compiled, functions, selectedIds, settings.angleMode, table, values]);

  const rows = useMemo(
    () => sortRows(result.rows, sortKey, sortDirection),
    [result.rows, sortDirection, sortKey],
  );

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const csv = () => tableToCsv(result, table.precision, table.notation);

  const downloadCsv = () => {
    const blob = new Blob([csv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.name.replace(/[^\w-]+/g, "-").toLowerCase() || "table"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(csv());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const variableOptions = compiled.allVariables.length ? compiled.allVariables : ["x"];

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeading
          title="Value table"
          description="Evaluate one variable over a range for any number of functions."
          actions={
            <>
              <Button size="sm" onClick={() => void copyCsv()}>
                {copied ? "Copied ✓" : "Copy CSV"}
              </Button>
              <Button size="sm" variant="primary" onClick={downloadCsv}>
                Export CSV
              </Button>
            </>
          }
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Variable" htmlFor="table-variable">
            <Select
              id="table-variable"
              value={table.variable}
              onChange={(event) =>
                dispatch({ type: "update-table", patch: { variable: event.target.value } })
              }
            >
              {variableOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start" htmlFor="table-start">
            <NumberInput
              id="table-start"
              value={table.start}
              onCommit={(start) => dispatch({ type: "update-table", patch: { start } })}
            />
          </Field>
          <Field label="End" htmlFor="table-end">
            <NumberInput
              id="table-end"
              value={table.end}
              onCommit={(end) => dispatch({ type: "update-table", patch: { end } })}
            />
          </Field>
          <Field label="Step" htmlFor="table-step">
            <NumberInput
              id="table-step"
              value={table.step}
              onCommit={(step) => dispatch({ type: "update-table", patch: { step } })}
            />
          </Field>
          <Field label="Decimals" htmlFor="table-precision">
            <NumberInput
              id="table-precision"
              value={table.precision}
              onCommit={(precision) =>
                dispatch({
                  type: "update-table",
                  patch: { precision: Math.max(0, Math.min(15, Math.round(precision))) },
                })
              }
            />
          </Field>
          <Field label="Notation" htmlFor="table-notation">
            <Select
              id="table-notation"
              value={table.notation}
              onChange={(event) =>
                dispatch({
                  type: "update-table",
                  patch: { notation: event.target.value as NumberNotation },
                })
              }
            >
              <option value="auto">Auto</option>
              <option value="fixed">Fixed</option>
              <option value="exponential">Scientific</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Columns:</span>
          {functions.map((fn) => {
            const active = selectedIds.includes(fn.id);
            return (
              <button
                key={fn.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const next = active
                    ? selectedIds.filter((id) => id !== fn.id)
                    : [...selectedIds, fn.id];
                  dispatch({ type: "update-table", patch: { functionIds: next } });
                }}
                className={cn(
                  "mono rounded-md border px-2 py-1 text-[11px] transition-colors",
                  active
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                    : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400",
                )}
              >
                {fn.signature}
              </button>
            );
          })}
        </div>
      </Card>

      {result.error ? <Alert tone="warning">{result.error}</Alert> : null}

      {functions.length === 0 ? (
        <EmptyState
          icon={<Table2 size={22} aria-hidden="true" />}
          title="No functions to tabulate"
          description="Add a function in the Function workspace first — then the table will fill automatically."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="max-h-[540px] overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Values of {result.columns.length} function(s) over {result.variable}
              </caption>
              <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort("__input")}
                      className="mono font-semibold"
                    >
                      {result.variable} {sortKey === "__input" ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                    </button>
                  </th>
                  {result.columns.map((column) => (
                    <th key={column.id} scope="col" className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="mono font-semibold"
                      >
                        {column.label}{" "}
                        {sortKey === column.id ? (sortDirection === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Inspect
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.input}
                    className="hover:bg-blue-50/60 dark:hover:bg-slate-800/60"
                  >
                    <td className="mono px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">
                      {formatNumber(row.input, table.precision, table.notation)}
                    </td>
                    {result.columns.map((column) => {
                      const cell = row.cells[column.id];
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            "mono px-3 py-1.5",
                            cell?.value === null
                              ? "bg-red-50/60 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                              : "text-slate-700 dark:text-slate-200",
                          )}
                        >
                          {cell?.value === null
                            ? (cell.error ?? "undefined")
                            : formatNumber(cell?.value ?? null, table.precision, table.notation)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => inspectPoint(row.input, result.variable)}
                        title="Show this point on the graph"
                      >
                        ◎ graph
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {rows.length} rows · undefined cells are highlighted · click “graph” to trace the value on
            the graph explorer.
          </p>
        </Card>
      )}
    </div>
  );
}
