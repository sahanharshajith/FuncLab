import type { NumberNotation } from "@/lib/types";
import { formatNumber } from "./format";

export const MAX_TABLE_ROWS = 2000;

export interface TableColumnDef {
  id: string;
  label: string;
}

export interface TableCell {
  value: number | null;
  error: string | null;
}

export interface TableRowData {
  input: number;
  cells: Record<string, TableCell>;
}

export interface TableResult {
  rows: TableRowData[];
  columns: TableColumnDef[];
  variable: string;
  truncated: boolean;
  error: string | null;
}

export function buildRange(start: number, end: number, step: number): {
  values: number[];
  truncated: boolean;
  error: string | null;
} {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
    return { values: [], truncated: false, error: "Start, end and step must be numbers." };
  }
  if (step === 0) return { values: [], truncated: false, error: "Step cannot be zero." };
  const direction = end >= start ? 1 : -1;
  const magnitude = Math.abs(step);
  const total = Math.floor(Math.abs(end - start) / magnitude) + 1;
  const truncated = total > MAX_TABLE_ROWS;
  const count = Math.min(total, MAX_TABLE_ROWS);
  const values: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const value = start + direction * magnitude * i;
    // Avoid float noise such as 0.30000000000000004
    values.push(Number(value.toPrecision(12)));
  }
  return {
    values,
    truncated,
    error: truncated
      ? `Range truncated to the first ${MAX_TABLE_ROWS} rows. Increase the step size for a wider range.`
      : null,
  };
}

export interface TableEvaluator {
  id: string;
  label: string;
  evaluate: ((input: number) => number | null) | null;
  error?: string | null;
}

export function generateTable(
  variable: string,
  start: number,
  end: number,
  step: number,
  evaluators: TableEvaluator[],
): TableResult {
  const { values, truncated, error } = buildRange(start, end, step);
  const columns = evaluators.map((item) => ({ id: item.id, label: item.label }));

  const rows: TableRowData[] = values.map((input) => {
    const cells: Record<string, TableCell> = {};
    for (const evaluator of evaluators) {
      if (!evaluator.evaluate) {
        cells[evaluator.id] = { value: null, error: evaluator.error ?? "Function has an error." };
        continue;
      }
      try {
        const value = evaluator.evaluate(input);
        cells[evaluator.id] =
          value === null || !Number.isFinite(value)
            ? { value: null, error: "undefined" }
            : { value, error: null };
      } catch {
        cells[evaluator.id] = { value: null, error: "error" };
      }
    }
    return { input, cells };
  });

  return { rows, columns, variable, truncated, error };
}

export function tableToCsv(
  result: TableResult,
  precision = 6,
  notation: NumberNotation = "auto",
): string {
  const header = [result.variable, ...result.columns.map((column) => column.label)];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of result.rows) {
    const cells = [formatNumber(row.input, precision, notation)];
    for (const column of result.columns) {
      const cell = row.cells[column.id];
      cells.push(cell && cell.value !== null ? formatNumber(cell.value, precision, notation) : "undefined");
    }
    lines.push(cells.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type SortDirection = "asc" | "desc";

export function sortRows(
  rows: TableRowData[],
  key: string,
  direction: SortDirection,
): TableRowData[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = key === "__input" ? a.input : a.cells[key]?.value;
    const bv = key === "__input" ? b.input : b.cells[key]?.value;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return (av - bv) * factor;
  });
}
