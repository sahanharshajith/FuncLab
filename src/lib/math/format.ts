import type { NumberNotation } from "@/lib/types";

/** Format a number for display according to workspace precision settings. */
export function formatNumber(
  value: number | null | undefined,
  precision = 6,
  notation: NumberNotation = "auto",
): string {
  if (value === null || value === undefined) return "—";
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "-∞";

  const digits = Math.min(Math.max(Math.round(precision), 0), 15);

  if (notation === "fixed") return value.toFixed(digits);
  if (notation === "exponential") return value.toExponential(digits);

  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-6) return value.toExponential(Math.min(digits, 10));

  const rounded = Number(value.toPrecision(Math.max(digits, 1)));
  // Avoid "-0"
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

/** Parse user typed numeric input, supporting decimals, negatives, scientific notation. */
export function parseNumberInput(input: string): number | null {
  const text = input.trim().replace(/\s+/g, "");
  if (!text || text === "-" || text === "+" || text === "." || text === "-.") return null;
  if (!/^[+-]?((\d+(\.\d*)?)|(\.\d+))([eE][+-]?\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
