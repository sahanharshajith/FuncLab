/**
 * Graph sampling utilities.
 *
 * Handles adaptive sampling, undefined regions and vertical asymptotes so the
 * renderer never draws misleading straight lines across a gap.
 */
import type { SampledSeries } from "@/lib/types";

export interface SampleOptions {
  samples?: number;
  adaptive?: boolean;
  /** Viewport height used to decide what counts as a "jump". */
  viewHeight?: number;
  maxExtraPoints?: number;
}

const MIN_SAMPLES = 25;
const MAX_SAMPLES = 4000;

export function clampSamples(samples: number | undefined, fallback = 600): number {
  const value = Number.isFinite(samples) ? Number(samples) : fallback;
  return Math.round(Math.min(Math.max(value, MIN_SAMPLES), MAX_SAMPLES));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

/**
 * Sample y = f(x) over [xMin, xMax].
 * Returns `null` for undefined values and inserts `null` breaks at detected
 * discontinuities (poles) so lines are not drawn across them.
 */
export function sampleFunction(
  evaluate: (x: number) => number | null,
  xMin: number,
  xMax: number,
  options: SampleOptions = {},
): SampledSeries {
  const count = clampSamples(options.samples);
  const adaptive = options.adaptive ?? true;
  const lo = Math.min(xMin, xMax);
  const hi = Math.max(xMin, xMax);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) {
    return { x: [], y: [] };
  }

  const step = (hi - lo) / count;
  const xs: number[] = [];
  const ys: (number | null)[] = [];

  for (let i = 0; i <= count; i += 1) {
    const x = lo + i * step;
    xs.push(x);
    ys.push(safeEvaluate(evaluate, x));
  }

  if (adaptive) {
    refine(evaluate, xs, ys, options.maxExtraPoints ?? Math.round(count / 2));
  }

  return breakDiscontinuities(xs, ys, options.viewHeight);
}

function safeEvaluate(evaluate: (x: number) => number | null, x: number): number | null {
  try {
    const value = evaluate(x);
    if (value === null || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Insert extra samples where the curve bends sharply or where the function
 * transitions between defined and undefined (domain boundary refinement).
 */
function refine(
  evaluate: (x: number) => number | null,
  xs: number[],
  ys: (number | null)[],
  budget: number,
): void {
  let remaining = budget;
  const yValues = ys.filter((y): y is number => y !== null);
  if (!yValues.length) return;
  const spread = Math.max(percentile(yValues, 95) - percentile(yValues, 5), 1e-9);
  const xSpread = Math.max(xs[xs.length - 1] - xs[0], 1e-9);

  for (let i = 0; i < xs.length - 1 && remaining > 0; i += 1) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const y0 = ys[i];
    const y1 = ys[i + 1];
    const definedBoundary = (y0 === null) !== (y1 === null);
    const sharpBend =
      y0 !== null &&
      y1 !== null &&
      Math.abs(y1 - y0) / spread > 0.05 &&
      Math.abs(x1 - x0) / xSpread > 1e-6;

    if (!definedBoundary && !sharpBend) continue;

    let left = x0;
    let right = x1;
    const inserted: { x: number; y: number | null }[] = [];
    const depth = definedBoundary ? 6 : 2;
    for (let d = 0; d < depth && remaining > 0; d += 1) {
      const mid = (left + right) / 2;
      const value = safeEvaluate(evaluate, mid);
      inserted.push({ x: mid, y: value });
      remaining -= 1;
      if (definedBoundary) {
        // Binary search toward the domain boundary.
        const leftDefined = y0 !== null;
        if ((value !== null) === leftDefined) left = mid;
        else right = mid;
      } else {
        break;
      }
    }
    inserted.sort((a, b) => a.x - b.x);
    xs.splice(i + 1, 0, ...inserted.map((p) => p.x));
    ys.splice(i + 1, 0, ...inserted.map((p) => p.y));
    i += inserted.length;
  }
}

/** Replace suspicious jumps (vertical asymptotes) with explicit gaps. */
export function breakDiscontinuities(
  xs: number[],
  ys: (number | null)[],
  viewHeight?: number,
): SampledSeries {
  const deltas: number[] = [];
  for (let i = 1; i < ys.length; i += 1) {
    const prev = ys[i - 1];
    const current = ys[i];
    if (prev === null || current === null) continue;
    deltas.push(Math.abs(current - prev));
  }
  const med = median(deltas.filter((d) => d > 0));
  const finite = ys.filter((y): y is number => y !== null);
  const span =
    viewHeight && Number.isFinite(viewHeight) && viewHeight > 0
      ? viewHeight
      : Math.max(percentile(finite, 97) - percentile(finite, 3), 1e-9);
  const threshold = Math.max(med * 12, span * 0.6);

  const outX: number[] = [];
  const outY: (number | null)[] = [];

  for (let i = 0; i < xs.length; i += 1) {
    const prev = ys[i - 1];
    const current = ys[i];
    if (i > 0 && prev !== null && current !== null) {
      const jump = Math.abs(current - prev);
      const signFlip = prev * current < 0;
      if (jump > threshold && (signFlip || jump > span * 4)) {
        outX.push((xs[i - 1] + xs[i]) / 2);
        outY.push(null);
      }
    }
    outX.push(xs[i]);
    outY.push(current);
  }

  return { x: outX, y: outY };
}

export interface ParametricSeries {
  x: (number | null)[];
  y: (number | null)[];
  t: number[];
}

export function sampleParametric(
  evaluateX: (t: number) => number | null,
  evaluateY: (t: number) => number | null,
  tMin: number,
  tMax: number,
  samples: number,
): ParametricSeries {
  const count = clampSamples(samples, 800);
  const step = (tMax - tMin) / count;
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const t: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    const tv = tMin + i * step;
    const xv = safeEvaluate(evaluateX, tv);
    const yv = safeEvaluate(evaluateY, tv);
    t.push(tv);
    x.push(xv === null || yv === null ? null : xv);
    y.push(xv === null || yv === null ? null : yv);
  }
  return { x, y, t };
}

export function samplePolar(
  evaluateR: (theta: number) => number | null,
  thetaMin: number,
  thetaMax: number,
  samples: number,
  angleMode: "rad" | "deg",
): ParametricSeries {
  const count = clampSamples(samples, 800);
  const step = (thetaMax - thetaMin) / count;
  const factor = angleMode === "deg" ? Math.PI / 180 : 1;
  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const t: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    const theta = thetaMin + i * step;
    const r = safeEvaluate(evaluateR, theta);
    t.push(theta);
    if (r === null) {
      x.push(null);
      y.push(null);
    } else {
      x.push(r * Math.cos(theta * factor));
      y.push(r * Math.sin(theta * factor));
    }
  }
  return { x, y, t };
}

export interface GridSample {
  x: number[];
  y: number[];
  z: (number | null)[][];
}

export function sampleGrid(
  evaluate: (x: number, y: number) => number | null,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  resolution: number,
): GridSample {
  const n = Math.round(Math.min(Math.max(resolution, 10), 160));
  const xs: number[] = [];
  const ys: number[] = [];
  const dx = (xMax - xMin) / n;
  const dy = (yMax - yMin) / n;
  for (let i = 0; i <= n; i += 1) xs.push(xMin + i * dx);
  for (let j = 0; j <= n; j += 1) ys.push(yMin + j * dy);

  const z: (number | null)[][] = [];
  for (let j = 0; j <= n; j += 1) {
    const row: (number | null)[] = [];
    for (let i = 0; i <= n; i += 1) {
      let value: number | null = null;
      try {
        value = evaluate(xs[i], ys[j]);
      } catch {
        value = null;
      }
      row.push(value !== null && Number.isFinite(value) ? value : null);
    }
    z.push(row);
  }
  return { x: xs, y: ys, z };
}

/** Robust y-range for auto scaling that ignores asymptote spikes. */
export function autoRange(series: SampledSeries[]): { min: number; max: number } | null {
  const values: number[] = [];
  for (const s of series) {
    for (const y of s.y) {
      if (y !== null && Number.isFinite(y)) values.push(y);
    }
  }
  if (!values.length) return null;
  let min = percentile(values, 2);
  let max = percentile(values, 98);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    min = Math.min(...values);
    max = Math.max(...values);
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  return { min: min - pad, max: max + pad };
}
