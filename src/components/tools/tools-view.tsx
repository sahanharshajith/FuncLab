"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { makeExpressionEvaluator } from "@/lib/math/workspace-eval";
import {
  convertUnits,
  definiteIntegral,
  describeStatistics,
  estimateLimit,
  findExtrema,
  findRoots,
  numericDerivative,
  parseDataset,
  symbolicDerivative,
} from "@/lib/math/analysis";
import { formatNumber } from "@/lib/math/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  NumberInput,
  PanelHeading,
  Select,
  TextInput,
} from "@/components/ui/primitives";

function ToolCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="h-fit">
      <PanelHeading title={title} description={description} />
      <div className="space-y-3 px-4 py-3">{children}</div>
    </Card>
  );
}

function ResultLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-200 py-1 text-xs last:border-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="mono font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

export function ToolsView() {
  const { workspace, compiled, values, addHistory } = useWorkspaceStore();
  const settings = workspace.data.settings;
  const precision = settings.precision;
  const firstExpression = workspace.data.functions[0]?.expression ?? "x^2";
  const variableOptions = compiled.allVariables.length ? compiled.allVariables : ["x"];

  const [expression, setExpression] = useState(firstExpression);
  const [variable, setVariable] = useState(variableOptions[0]);
  const [point, setPoint] = useState(1);
  const [lower, setLower] = useState(0);
  const [upper, setUpper] = useState(1);
  const [equationLeft, setEquationLeft] = useState("x^2");
  const [equationRight, setEquationRight] = useState("4");
  const [dataset, setDataset] = useState("4, 8, 15, 16, 23, 42");
  const [unitValue, setUnitValue] = useState(1);
  const [fromUnit, setFromUnit] = useState("km");
  const [toUnit, setToUnit] = useState("mile");
  const [output, setOutput] = useState<{ title: string; lines: [string, string][]; note?: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const evaluatorOptions = useMemo(
    () => ({ angleMode: settings.angleMode, values }),
    [settings.angleMode, values],
  );

  const buildEvaluator = (source: string) =>
    makeExpressionEvaluator(compiled, source, variable, evaluatorOptions);

  const run = (
    title: string,
    compute: () => { lines: [string, string][]; note?: string } | string,
  ) => {
    try {
      const result = compute();
      if (typeof result === "string") {
        setError(result);
        setOutput(null);
        return;
      }
      setError(null);
      setOutput({ title, lines: result.lines, note: result.note });
      void addHistory({
        kind: title.toLowerCase().replace(/\s+/g, "-"),
        expression: `${title}: ${expression}`,
        result: result.lines.map(([label, value]) => `${label}=${value}`).join(", ").slice(0, 300),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Calculation failed.");
      setOutput(null);
    }
  };

  const stats = useMemo(() => describeStatistics(parseDataset(dataset)), [dataset]);
  const conversion = useMemo(
    () => convertUnits(unitValue, fromUnit, toUnit),
    [fromUnit, toUnit, unitValue],
  );

  return (
    <div className="space-y-4">
      <Card>
        <PanelHeading
          title="Numerical analysis tools"
          description="All results below are numerical approximations unless explicitly labelled symbolic."
          actions={<Badge tone="warning">Approximate results</Badge>}
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Expression" htmlFor="tool-expression" className="sm:col-span-2">
            <TextInput
              id="tool-expression"
              value={expression}
              spellCheck={false}
              className="mono"
              onChange={(event) => setExpression(event.target.value)}
            />
          </Field>
          <Field label="Variable" htmlFor="tool-variable">
            <Select
              id="tool-variable"
              value={variable}
              onChange={(event) => setVariable(event.target.value)}
            >
              {[...new Set([...variableOptions, variable])].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quick fill" htmlFor="tool-quickfill">
            <Select
              id="tool-quickfill"
              value=""
              onChange={(event) => {
                const fn = workspace.data.functions.find((item) => item.id === event.target.value);
                if (fn) setExpression(fn.expression);
              }}
            >
              <option value="">Use a workspace function…</option>
              {workspace.data.functions.map((fn) => (
                <option key={fn.id} value={fn.id}>
                  {fn.signature} = {fn.expression}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {output ? (
        <Card>
          <PanelHeading title={output.title} description={output.note} />
          <div className="px-4 py-2">
            {output.lines.map(([label, value]) => (
              <ResultLine key={label} label={label} value={value} />
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ToolCard
          title="Derivative"
          description="Central-difference numerical derivative with Richardson extrapolation."
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Point ${variable} =`} htmlFor="derivative-point">
              <NumberInput id="derivative-point" value={point} onCommit={setPoint} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                run("Numerical derivative", () => {
                  const evaluate = buildEvaluator(expression);
                  if (!evaluate) return "The expression could not be parsed.";
                  const first = numericDerivative(evaluate, point, 1);
                  const second = numericDerivative(evaluate, point, 2);
                  const symbolic = symbolicDerivative(expression, variable);
                  const lines: [string, string][] = [
                    [`f'(${formatNumber(point, 4)})`, formatNumber(first.value, precision)],
                    [`f''(${formatNumber(point, 4)})`, formatNumber(second.value, precision)],
                    ["step size h", formatNumber(first.stepSize, 4)],
                  ];
                  if (symbolic) lines.push(["symbolic derivative", symbolic]);
                  return {
                    lines,
                    note: first.error
                      ? first.error
                      : `${first.method} — numerical approximation${symbolic ? "; symbolic form from mathjs" : ""}.`,
                  };
                })
              }
            >
              Differentiate
            </Button>
          </div>
        </ToolCard>

        <ToolCard title="Definite integral" description="Adaptive Simpson quadrature.">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lower bound" htmlFor="integral-lower">
              <NumberInput id="integral-lower" value={lower} onCommit={setLower} />
            </Field>
            <Field label="Upper bound" htmlFor="integral-upper">
              <NumberInput id="integral-upper" value={upper} onCommit={setUpper} />
            </Field>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run("Definite integral", () => {
                const evaluate = buildEvaluator(expression);
                if (!evaluate) return "The expression could not be parsed.";
                const result = definiteIntegral(evaluate, lower, upper);
                return {
                  lines: [
                    ["∫ result", formatNumber(result.value, precision)],
                    ["interval", `[${formatNumber(lower, 4)}, ${formatNumber(upper, 4)}]`],
                    ["subdivisions", String(result.subdivisions)],
                  ],
                  note: result.error ?? `${result.method} — numerical approximation.`,
                };
              })
            }
          >
            Integrate
          </Button>
        </ToolCard>

        <ToolCard title="Roots / zeros" description="Sign-change scan refined by bisection.">
          <div className="grid grid-cols-2 gap-2">
            <Field label="From" htmlFor="roots-from">
              <NumberInput id="roots-from" value={lower} onCommit={setLower} />
            </Field>
            <Field label="To" htmlFor="roots-to">
              <NumberInput id="roots-to" value={upper} onCommit={setUpper} />
            </Field>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run("Roots", () => {
                const evaluate = buildEvaluator(expression);
                if (!evaluate) return "The expression could not be parsed.";
                const roots = findRoots(evaluate, lower, upper);
                if (!roots.length) {
                  return {
                    lines: [["roots found", "none in this interval"]],
                    note: "No sign change was detected. Try a wider interval — tangential roots may be missed.",
                  };
                }
                return {
                  lines: roots.map((root, index): [string, string] => [
                    `root ${index + 1}`,
                    `${variable} ≈ ${formatNumber(root.x, precision)}`,
                  ]),
                  note: "Numerical roots (bisection). Values are approximations, not exact symbolic solutions.",
                };
              })
            }
          >
            Find roots
          </Button>
        </ToolCard>

        <ToolCard title="Minima & maxima" description="Grid scan refined with golden-section search.">
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run("Extrema", () => {
                const evaluate = buildEvaluator(expression);
                if (!evaluate) return "The expression could not be parsed.";
                const extrema = findExtrema(evaluate, lower, upper);
                if (!extrema.length) {
                  return {
                    lines: [["extrema", "none detected"]],
                    note: "No local minimum or maximum was found inside the interval.",
                  };
                }
                return {
                  lines: extrema.map((item, index): [string, string] => [
                    `${item.kind} ${index + 1}`,
                    `(${formatNumber(item.x, precision)}, ${formatNumber(item.y, precision)})`,
                  ]),
                  note: `Local extrema inside [${formatNumber(lower, 4)}, ${formatNumber(upper, 4)}] — numerical approximation.`,
                };
              })
            }
          >
            Find extrema
          </Button>
        </ToolCard>

        <ToolCard title="Limit estimation" description="Two-sided numerical approach to a point.">
          <Field label={`Approach ${variable} →`} htmlFor="limit-point">
            <NumberInput id="limit-point" value={point} onCommit={setPoint} />
          </Field>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run("Limit", () => {
                const evaluate = buildEvaluator(expression);
                if (!evaluate) return "The expression could not be parsed.";
                const limit = estimateLimit(evaluate, point);
                return {
                  lines: [
                    ["left limit", formatNumber(limit.left, precision)],
                    ["right limit", formatNumber(limit.right, precision)],
                    ["estimate", limit.exists ? formatNumber(limit.estimate, precision) : "does not exist"],
                  ],
                  note: limit.note,
                };
              })
            }
          >
            Estimate limit
          </Button>
        </ToolCard>

        <ToolCard title="Equation solver" description="Solves left = right numerically on an interval.">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Left side" htmlFor="equation-left">
              <TextInput
                id="equation-left"
                className="mono"
                value={equationLeft}
                onChange={(event) => setEquationLeft(event.target.value)}
              />
            </Field>
            <Field label="Right side" htmlFor="equation-right">
              <TextInput
                id="equation-right"
                className="mono"
                value={equationRight}
                onChange={(event) => setEquationRight(event.target.value)}
              />
            </Field>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              run("Equation solution", () => {
                const evaluate = makeExpressionEvaluator(
                  compiled,
                  `(${equationLeft}) - (${equationRight})`,
                  variable,
                  evaluatorOptions,
                );
                if (!evaluate) return "One of the sides could not be parsed.";
                const roots = findRoots(evaluate, lower, upper, 1200);
                if (!roots.length) {
                  return {
                    lines: [["solutions", "none in this interval"]],
                    note: `Searched ${variable} ∈ [${formatNumber(lower, 4)}, ${formatNumber(upper, 4)}].`,
                  };
                }
                return {
                  lines: roots.map((root, index): [string, string] => [
                    `solution ${index + 1}`,
                    `${variable} ≈ ${formatNumber(root.x, precision)}`,
                  ]),
                  note: "Numerical solutions only — exact/symbolic algebra is not performed.",
                };
              })
            }
          >
            Solve
          </Button>
        </ToolCard>

        <ToolCard title="Statistics" description="Descriptive statistics for a dataset.">
          <Field label="Dataset" htmlFor="stats-dataset" hint="Separate values with commas or spaces.">
            <textarea
              id="stats-dataset"
              value={dataset}
              onChange={(event) => setDataset(event.target.value)}
              rows={3}
              className="mono w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </Field>
          {stats ? (
            <div>
              <ResultLine label="count" value={stats.count} />
              <ResultLine label="mean" value={formatNumber(stats.mean, precision)} />
              <ResultLine label="median" value={formatNumber(stats.median, precision)} />
              <ResultLine label="std dev (sample)" value={formatNumber(stats.stdDevSample, precision)} />
              <ResultLine label="std dev (population)" value={formatNumber(stats.stdDevPopulation, precision)} />
              <ResultLine label="min / max" value={`${formatNumber(stats.min, precision)} / ${formatNumber(stats.max, precision)}`} />
              <ResultLine label="Q1 / Q3" value={`${formatNumber(stats.q1, precision)} / ${formatNumber(stats.q3, precision)}`} />
            </div>
          ) : (
            <Alert tone="warning">Enter at least one numeric value.</Alert>
          )}
        </ToolCard>

        <ToolCard title="Unit conversion" description="Powered by the mathjs unit system.">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Value" htmlFor="unit-value">
              <NumberInput id="unit-value" value={unitValue} onCommit={setUnitValue} />
            </Field>
            <Field label="From" htmlFor="unit-from">
              <TextInput
                id="unit-from"
                className="mono"
                value={fromUnit}
                onChange={(event) => setFromUnit(event.target.value)}
              />
            </Field>
            <Field label="To" htmlFor="unit-to">
              <TextInput
                id="unit-to"
                className="mono"
                value={toUnit}
                onChange={(event) => setToUnit(event.target.value)}
              />
            </Field>
          </div>
          {conversion.error ? (
            <Alert tone="error">{conversion.error}</Alert>
          ) : (
            <ResultLine label="result" value={conversion.display} />
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Try km → mile, celsius → fahrenheit, J → kWh, rad → deg.
          </p>
        </ToolCard>
      </div>
    </div>
  );
}
