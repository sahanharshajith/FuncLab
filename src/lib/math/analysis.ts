/**
 * Numerical analysis helpers.
 *
 * Every result produced here is a *numerical approximation* (except the
 * clearly labelled symbolic derivative) and the UI states that explicitly.
 */
import { derivative as symbolicDerivativeFn, unit as mathUnit } from "mathjs";
import { parseExpression } from "./engine";

export type NumericFn = (x: number) => number | null;

function evalAt(f: NumericFn, x: number): number | null {
  try {
    const value = f(x);
    return value !== null && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export interface DerivativeResult {
  value: number | null;
  method: string;
  error: string | null;
  stepSize: number;
}

/** Central difference derivative with Richardson extrapolation. */
export function numericDerivative(f: NumericFn, x: number, order: 1 | 2 = 1): DerivativeResult {
  const h = Math.max(Math.abs(x), 1) * 1e-5;

  if (order === 2) {
    const fx = evalAt(f, x);
    const fp = evalAt(f, x + h);
    const fm = evalAt(f, x - h);
    if (fx === null || fp === null || fm === null) {
      return {
        value: null,
        method: "Central difference (2nd order)",
        error: "Function is undefined near this point.",
        stepSize: h,
      };
    }
    return {
      value: (fp - 2 * fx + fm) / (h * h),
      method: "Central difference (2nd order)",
      error: null,
      stepSize: h,
    };
  }

  const d = (step: number): number | null => {
    const fp = evalAt(f, x + step);
    const fm = evalAt(f, x - step);
    if (fp === null || fm === null) return null;
    return (fp - fm) / (2 * step);
  };

  const d1 = d(h);
  const d2 = d(h / 2);
  if (d1 === null && d2 === null) {
    return {
      value: null,
      method: "Central difference",
      error: "Function is undefined near this point (check the domain).",
      stepSize: h,
    };
  }
  if (d1 === null || d2 === null) {
    return {
      value: (d1 ?? d2) as number,
      method: "Central difference",
      error: null,
      stepSize: h,
    };
  }
  return {
    value: (4 * d2 - d1) / 3,
    method: "Richardson extrapolated central difference",
    error: null,
    stepSize: h,
  };
}

/** Symbolic derivative, when mathjs can compute one. */
export function symbolicDerivative(expression: string, variable: string): string | null {
  try {
    parseExpression(expression); // validate against the restricted rules first
    return symbolicDerivativeFn(expression, variable).toString();
  } catch {
    return null;
  }
}

export interface IntegralResult {
  value: number | null;
  method: string;
  error: string | null;
  subdivisions: number;
}

/** Adaptive Simpson integration. */
export function definiteIntegral(
  f: NumericFn,
  a: number,
  b: number,
  tolerance = 1e-8,
  maxDepth = 18,
): IntegralResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { value: null, method: "Adaptive Simpson", error: "Bounds must be finite numbers.", subdivisions: 0 };
  }
  if (a === b) return { value: 0, method: "Adaptive Simpson", error: null, subdivisions: 0 };

  const sign = b > a ? 1 : -1;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let subdivisions = 0;
  let undefinedPoints = 0;

  const safe = (x: number): number => {
    const value = evalAt(f, x);
    if (value === null) {
      undefinedPoints += 1;
      return 0;
    }
    return value;
  };

  const simpson = (x0: number, x2: number, f0: number, f1: number, f2: number): number =>
    ((x2 - x0) / 6) * (f0 + 4 * f1 + f2);

  const recurse = (
    x0: number,
    x2: number,
    f0: number,
    f1: number,
    f2: number,
    whole: number,
    depth: number,
  ): number => {
    subdivisions += 1;
    const xm1 = (x0 + (x0 + x2) / 2) / 2;
    const xm2 = ((x0 + x2) / 2 + x2) / 2;
    const fm1 = safe(xm1);
    const fm2 = safe(xm2);
    const left = simpson(x0, (x0 + x2) / 2, f0, fm1, f1);
    const right = simpson((x0 + x2) / 2, x2, f1, fm2, f2);
    const delta = left + right - whole;
    if (depth >= maxDepth || Math.abs(delta) <= 15 * tolerance) {
      return left + right + delta / 15;
    }
    return (
      recurse(x0, (x0 + x2) / 2, f0, fm1, f1, left, depth + 1) +
      recurse((x0 + x2) / 2, x2, f1, fm2, f2, right, depth + 1)
    );
  };

  const f0 = safe(lo);
  const f1 = safe((lo + hi) / 2);
  const f2 = safe(hi);
  const whole = simpson(lo, hi, f0, f1, f2);
  const value = sign * recurse(lo, hi, f0, f1, f2, whole, 0);

  return {
    value: Number.isFinite(value) ? value : null,
    method: "Adaptive Simpson (numerical)",
    error: undefinedPoints
      ? `${undefinedPoints} sample point(s) were undefined and treated as 0 — the result may be inaccurate.`
      : null,
    subdivisions,
  };
}

export interface RootResult {
  x: number;
  fx: number;
}

/** Scan for sign changes, then refine with bisection. */
export function findRoots(
  f: NumericFn,
  a: number,
  b: number,
  scanPoints = 800,
  tolerance = 1e-10,
): RootResult[] {
  const roots: RootResult[] = [];
  const step = (b - a) / scanPoints;
  let prevX = a;
  let prevY = evalAt(f, a);

  const pushRoot = (x: number) => {
    const fx = evalAt(f, x) ?? 0;
    if (roots.some((root) => Math.abs(root.x - x) < Math.abs(step) / 2)) return;
    roots.push({ x, fx });
  };

  if (prevY !== null && Math.abs(prevY) < tolerance) pushRoot(a);

  for (let i = 1; i <= scanPoints; i += 1) {
    const x = a + i * step;
    const y = evalAt(f, x);
    if (y !== null && Math.abs(y) < 1e-12) {
      pushRoot(x);
    } else if (prevY !== null && y !== null && prevY * y < 0) {
      let left = prevX;
      let right = x;
      let fLeft = prevY;
      for (let k = 0; k < 100; k += 1) {
        const mid = (left + right) / 2;
        const fMid = evalAt(f, mid);
        if (fMid === null) break;
        if (Math.abs(fMid) < tolerance || (right - left) / 2 < 1e-12) {
          pushRoot(mid);
          break;
        }
        if (fLeft * fMid < 0) {
          right = mid;
        } else {
          left = mid;
          fLeft = fMid;
        }
        if (k === 99) pushRoot(mid);
      }
    }
    prevX = x;
    prevY = y;
    if (roots.length >= 50) break;
  }
  return roots;
}

export interface ExtremumResult {
  x: number;
  y: number;
  kind: "minimum" | "maximum";
}

/** Grid scan for local extrema, refined with golden-section search. */
export function findExtrema(
  f: NumericFn,
  a: number,
  b: number,
  scanPoints = 600,
): ExtremumResult[] {
  const xs: number[] = [];
  const ys: (number | null)[] = [];
  const step = (b - a) / scanPoints;
  for (let i = 0; i <= scanPoints; i += 1) {
    const x = a + i * step;
    xs.push(x);
    ys.push(evalAt(f, x));
  }

  const results: ExtremumResult[] = [];
  for (let i = 1; i < xs.length - 1; i += 1) {
    const prev = ys[i - 1];
    const current = ys[i];
    const next = ys[i + 1];
    if (prev === null || current === null || next === null) continue;
    const isMin = current < prev && current < next;
    const isMax = current > prev && current > next;
    if (!isMin && !isMax) continue;
    const refined = goldenSection(f, xs[i - 1], xs[i + 1], isMin);
    if (refined) {
      results.push({ x: refined.x, y: refined.y, kind: isMin ? "minimum" : "maximum" });
    }
    if (results.length >= 30) break;
  }
  return results;
}

function goldenSection(
  f: NumericFn,
  a: number,
  b: number,
  minimize: boolean,
): { x: number; y: number } | null {
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let c = hi - phi * (hi - lo);
  let d = lo + phi * (hi - lo);
  const score = (x: number): number | null => {
    const value = evalAt(f, x);
    if (value === null) return null;
    return minimize ? value : -value;
  };
  let fc = score(c);
  let fd = score(d);
  if (fc === null || fd === null) return null;

  for (let i = 0; i < 100 && Math.abs(hi - lo) > 1e-10; i += 1) {
    if (fc < fd) {
      hi = d;
      d = c;
      fd = fc;
      c = hi - phi * (hi - lo);
      fc = score(c);
      if (fc === null) return null;
    } else {
      lo = c;
      c = d;
      fc = fd;
      d = lo + phi * (hi - lo);
      fd = score(d);
      if (fd === null) return null;
    }
  }
  const x = (lo + hi) / 2;
  const y = evalAt(f, x);
  return y === null ? null : { x, y };
}

export interface LimitResult {
  left: number | null;
  right: number | null;
  estimate: number | null;
  exists: boolean;
  note: string;
}

export function estimateLimit(f: NumericFn, x0: number): LimitResult {
  const approach = (direction: -1 | 1): number | null => {
    let last: number | null = null;
    for (let k = 1; k <= 8; k += 1) {
      const h = 10 ** -k * Math.max(Math.abs(x0), 1);
      const value = evalAt(f, x0 + direction * h);
      if (value === null) continue;
      last = value;
    }
    return last;
  };
  const left = approach(-1);
  const right = approach(1);
  if (left === null || right === null) {
    return {
      left,
      right,
      estimate: left ?? right,
      exists: false,
      note: "The function is undefined on at least one side — the numerical limit may not exist.",
    };
  }
  const tolerance = Math.max(1e-6, Math.abs(left) * 1e-6);
  const exists = Math.abs(left - right) <= tolerance;
  return {
    left,
    right,
    estimate: exists ? (left + right) / 2 : null,
    exists,
    note: exists
      ? "Numerical estimate from both sides (not a symbolic proof)."
      : "Left and right limits differ — the two-sided limit does not exist.",
  };
}

export interface StatisticsResult {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  variancePopulation: number;
  varianceSample: number;
  stdDevPopulation: number;
  stdDevSample: number;
  q1: number;
  q3: number;
}

export function describeStatistics(values: number[]): StatisticsResult | null {
  const data = values.filter((v) => Number.isFinite(v));
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => a - b);
  const count = data.length;
  const sum = data.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;
  const quantile = (p: number): number => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
  };
  const sqDiff = data.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const variancePopulation = sqDiff / count;
  const varianceSample = count > 1 ? sqDiff / (count - 1) : 0;
  return {
    count,
    sum,
    mean,
    median: quantile(0.5),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    range: sorted[sorted.length - 1] - sorted[0],
    variancePopulation,
    varianceSample,
    stdDevPopulation: Math.sqrt(variancePopulation),
    stdDevSample: Math.sqrt(varianceSample),
    q1: quantile(0.25),
    q3: quantile(0.75),
  };
}

export function parseDataset(input: string): number[] {
  return input
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

export interface UnitConversionResult {
  value: number | null;
  display: string;
  error: string | null;
}

export function convertUnits(value: number, from: string, to: string): UnitConversionResult {
  try {
    const converted = mathUnit(value, from).to(to);
    return {
      value: converted.toNumber(to),
      display: converted.toString(),
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      display: "—",
      error: error instanceof Error ? error.message : "Conversion failed.",
    };
  }
}
