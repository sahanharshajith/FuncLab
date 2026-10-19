import { describe, expect, it } from "vitest";
import {
  autoRange,
  sampleFunction,
  sampleGrid,
  sampleParametric,
  samplePolar,
} from "@/lib/math/sampling";
import { buildRange, generateTable, sortRows, tableToCsv } from "@/lib/math/table";
import {
  definiteIntegral,
  describeStatistics,
  estimateLimit,
  findExtrema,
  findRoots,
  numericDerivative,
} from "@/lib/math/analysis";

describe("graph sampling", () => {
  it("samples a smooth function across the range", () => {
    const series = sampleFunction((x) => x * x, -5, 5, { samples: 100, adaptive: false });
    expect(series.x[0]).toBeCloseTo(-5);
    expect(series.x[series.x.length - 1]).toBeCloseTo(5);
    expect(series.y.every((y) => y !== null)).toBe(true);
  });

  it("returns gaps instead of fake lines outside the domain", () => {
    const series = sampleFunction(
      (x) => (x < 2 ? null : Math.sqrt(x - 2)),
      -5,
      5,
      { samples: 120 },
    );
    const firstDefined = series.y.findIndex((y) => y !== null);
    expect(firstDefined).toBeGreaterThan(0);
    expect(series.y.slice(0, firstDefined).every((y) => y === null)).toBe(true);
  });

  it("breaks the line at a vertical asymptote", () => {
    const series = sampleFunction((x) => 1 / (x - 1), -5, 5, { samples: 400, viewHeight: 20 });
    const nullCount = series.y.filter((y) => y === null).length;
    expect(nullCount).toBeGreaterThan(0);
  });

  it("samples parametric and polar curves", () => {
    const parametric = sampleParametric(
      (t) => Math.cos(t),
      (t) => Math.sin(t),
      0,
      Math.PI * 2,
      100,
    );
    expect(parametric.x).toHaveLength(101);
    expect(parametric.x[0]).toBeCloseTo(1);

    const polar = samplePolar((theta) => 2 * Math.cos(theta), 0, Math.PI, 90, "rad");
    expect(polar.x[0]).toBeCloseTo(2);
    expect(polar.y[0]).toBeCloseTo(0);
  });

  it("samples a 2D grid for surfaces and implicit curves", () => {
    const grid = sampleGrid((x, y) => x * x + y * y, -1, 1, -1, 1, 10);
    expect(grid.z).toHaveLength(11);
    expect(grid.z[0]).toHaveLength(11);
    expect(grid.z[5][5]).toBeCloseTo(0);
  });

  it("computes a robust auto range that ignores spikes", () => {
    const x = Array.from({ length: 101 }, (_, index) => index);
    const y = x.map((value) => (value === 50 ? 1e9 : value / 10));
    const range = autoRange([{ x, y }]);
    expect(range).not.toBeNull();
    expect(range!.max).toBeLessThan(1e6);
  });
});

describe("table generation and CSV export", () => {
  it("builds an inclusive range", () => {
    const { values } = buildRange(-5, 5, 1);
    expect(values).toHaveLength(11);
    expect(values[0]).toBe(-5);
    expect(values[10]).toBe(5);
  });

  it("truncates huge ranges instead of freezing", () => {
    const result = buildRange(0, 1e6, 0.1);
    expect(result.truncated).toBe(true);
    expect(result.values.length).toBeLessThanOrEqual(2000);
  });

  it("rejects a zero step", () => {
    expect(buildRange(0, 10, 0).error).toMatch(/Step/);
  });

  it("generates rows with undefined cells marked", () => {
    const table = generateTable("x", -1, 1, 1, [
      { id: "f", label: "f(x)", evaluate: (x) => x * x },
      { id: "p", label: "p(x)", evaluate: (x) => (x < 0 ? null : Math.sqrt(x)) },
    ]);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0].cells.p.value).toBeNull();
    expect(table.rows[2].cells.f.value).toBe(1);
  });

  it("exports CSV with headers and undefined markers", () => {
    const table = generateTable("x", 0, 1, 1, [
      { id: "f", label: "f(x)", evaluate: (x) => (x === 0 ? null : 1 / x) },
    ]);
    const csv = tableToCsv(table, 4);
    expect(csv.split("\n")[0]).toBe("x,f(x)");
    expect(csv).toContain("undefined");
  });

  it("sorts rows by a column", () => {
    const table = generateTable("x", 1, 3, 1, [
      { id: "f", label: "f(x)", evaluate: (x) => -x },
    ]);
    const sorted = sortRows(table.rows, "f", "asc");
    expect(sorted[0].input).toBe(3);
  });
});

describe("numerical analysis", () => {
  it("approximates derivatives", () => {
    const d = numericDerivative((x) => x ** 3, 2);
    expect(d.value).toBeCloseTo(12, 4);
    const d2 = numericDerivative((x) => x ** 3, 2, 2);
    expect(d2.value).toBeCloseTo(12, 2);
  });

  it("approximates definite integrals", () => {
    const result = definiteIntegral((x) => x * x, 0, 3);
    expect(result.value).toBeCloseTo(9, 6);
    const sine = definiteIntegral((x) => Math.sin(x), 0, Math.PI);
    expect(sine.value).toBeCloseTo(2, 6);
  });

  it("finds roots by sign change", () => {
    const roots = findRoots((x) => x * x - 4, -5, 5);
    const values = roots.map((root) => Math.round(root.x * 1000) / 1000).sort((a, b) => a - b);
    expect(values[0]).toBeCloseTo(-2, 3);
    expect(values[values.length - 1]).toBeCloseTo(2, 3);
  });

  it("finds local extrema", () => {
    const extrema = findExtrema((x) => x ** 3 - 3 * x, -3, 3);
    const minimum = extrema.find((item) => item.kind === "minimum");
    const maximum = extrema.find((item) => item.kind === "maximum");
    expect(minimum?.x).toBeCloseTo(1, 2);
    expect(maximum?.x).toBeCloseTo(-1, 2);
  });

  it("estimates one and two sided limits", () => {
    const limit = estimateLimit((x) => Math.sin(x) / x, 0);
    expect(limit.exists).toBe(true);
    expect(limit.estimate).toBeCloseTo(1, 5);

    const jump = estimateLimit((x) => (x < 0 ? -1 : 1), 0);
    expect(jump.exists).toBe(false);
  });

  it("describes datasets", () => {
    const stats = describeStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats?.mean).toBe(5);
    expect(stats?.stdDevPopulation).toBeCloseTo(2);
    expect(stats?.median).toBe(4.5);
  });
});
