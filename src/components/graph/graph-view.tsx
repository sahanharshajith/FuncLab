"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotLayout, PlotTrace } from "plotly.js-dist-min";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useUi } from "@/lib/ui-context";
import { makeEvaluator, makeEvaluator2D } from "@/lib/math/workspace-eval";
import {
  autoRange,
  sampleFunction,
  sampleGrid,
  sampleParametric,
  samplePolar,
} from "@/lib/math/sampling";
import { formatNumber } from "@/lib/math/format";
import type { GraphMode } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  NumberInput,
  PanelHeading,
  Select,
  Toggle,
  cn,
} from "@/components/ui/primitives";
import { Plot, type HoverPoint } from "./plot";

const MODE_LABELS: Record<GraphMode, string> = {
  cartesian: "2D Cartesian  y = f(x)",
  parametric: "Parametric  x(t), y(t)",
  polar: "Polar  r = f(θ)",
  implicit: "Implicit  f(x, y) = k",
  surface: "3D surface  z = f(x, y)",
  points: "Points only",
};

export function GraphView({ embedded = false }: { embedded?: boolean }) {
  const { workspace, dispatch, compiled, values, theme } = useWorkspaceStore();
  const { focusPoint, setFocusPoint } = useUi();
  const graph = workspace.data.graph;
  const settings = workspace.data.settings;
  const functions = workspace.data.functions;
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const [revision, setRevision] = useState(0);
  const [showSettings, setShowSettings] = useState(!embedded);
  const [traceX, setTraceX] = useState<number>(() => (graph.xMin + graph.xMax) / 2);
  const [traceEnabled, setTraceEnabled] = useState(false);
  const plotElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (focusPoint) {
      setTraceEnabled(true);
      setTraceX(focusPoint.x);
    }
  }, [focusPoint]);

  const isDark = theme === "dark" ? graph.theme !== "light" : graph.theme === "dark";

  const { traces, warnings, traceReadout } = useMemo(() => {
    const result: PlotTrace[] = [];
    const notes: string[] = [];
    const readout: { name: string; color: string; y: number | null }[] = [];
    const evaluatorOptions = { angleMode: settings.angleMode, values };
    const viewHeight = graph.autoY ? undefined : Math.abs(graph.yMax - graph.yMin);

    const visibleFunctions = functions.filter((fn) => fn.visible && fn.enabled);

    if (graph.mode === "cartesian") {
      for (const fn of visibleFunctions) {
        const compiledFn = compiled.byId.get(fn.id);
        if (!compiledFn || compiledFn.error) {
          if (compiledFn?.error) notes.push(`${fn.signature}: ${compiledFn.error}`);
          continue;
        }
        if (compiledFn.variables.length > 1 && !compiledFn.variables.includes(graph.axisVariable)) {
          notes.push(
            `${fn.signature} does not use "${graph.axisVariable}" — it is drawn as a constant line.`,
          );
        }
        const evaluate = makeEvaluator(compiled, fn.id, graph.axisVariable, evaluatorOptions);
        if (!evaluate) continue;
        const series = sampleFunction(evaluate, graph.xMin, graph.xMax, {
          samples: graph.samples,
          viewHeight,
        });
        result.push({
          type: "scatter",
          mode: "lines",
          name: fn.signature,
          x: series.x,
          y: series.y,
          line: { color: fn.color, width: graph.lineWidth, shape: "linear" },
          connectgaps: false,
          hovertemplate: `${fn.signature}<br>${graph.axisVariable}=%{x:.6g}<br>y=%{y:.6g}<extra></extra>`,
        });

        if (traceEnabled) {
          const y = evaluate(traceX);
          readout.push({ name: fn.signature, color: fn.color, y });
          if (y !== null) {
            result.push({
              type: "scatter",
              mode: "markers",
              name: `${fn.signature} trace`,
              x: [traceX],
              y: [y],
              marker: { color: fn.color, size: 10, line: { color: "#fff", width: 1.5 } },
              showlegend: false,
              hovertemplate: `${fn.signature}(${formatNumber(traceX, 6)}) = %{y:.6g}<extra></extra>`,
            });
          }
        }
      }
      if (!result.length && !notes.length) {
        notes.push("No visible functions — enable the eye icon on a function card to plot it.");
      }
    }

    if (graph.mode === "parametric") {
      const xFn = graph.parametricX ? compiled.byId.get(graph.parametricX) : null;
      const yFn = graph.parametricY ? compiled.byId.get(graph.parametricY) : null;
      if (!xFn || !yFn) {
        notes.push("Choose a function for x(t) and one for y(t).");
      } else {
        const evalX = makeEvaluator(compiled, xFn.id, graph.paramVariable, evaluatorOptions);
        const evalY = makeEvaluator(compiled, yFn.id, graph.paramVariable, evaluatorOptions);
        if (!evalX || !evalY) {
          notes.push("One of the selected functions has an error.");
        } else {
          const series = sampleParametric(evalX, evalY, graph.tMin, graph.tMax, graph.tSamples);
          result.push({
            type: "scatter",
            mode: "lines",
            name: `(${xFn.def.signature}, ${yFn.def.signature})`,
            x: series.x,
            y: series.y,
            line: { color: xFn.def.color, width: graph.lineWidth },
            connectgaps: false,
            hovertemplate: "x=%{x:.6g}<br>y=%{y:.6g}<extra></extra>",
          });
        }
      }
    }

    if (graph.mode === "polar") {
      const polarFn = graph.polarFunction ? compiled.byId.get(graph.polarFunction) : null;
      if (!polarFn) {
        notes.push("Choose the function that defines r(θ).");
      } else {
        const evaluate = makeEvaluator(compiled, polarFn.id, graph.polarVariable, evaluatorOptions);
        if (!evaluate) {
          notes.push(`${polarFn.def.signature} has an error.`);
        } else {
          const series = samplePolar(
            evaluate,
            graph.tMin,
            graph.tMax,
            graph.tSamples,
            settings.angleMode,
          );
          result.push({
            type: "scatter",
            mode: "lines",
            name: `r = ${polarFn.def.expression}`,
            x: series.x,
            y: series.y,
            line: { color: polarFn.def.color, width: graph.lineWidth },
            connectgaps: false,
            hovertemplate: "x=%{x:.6g}<br>y=%{y:.6g}<extra></extra>",
          });
          notes.push(
            `Polar curve converted to cartesian coordinates. θ sweeps from ${formatNumber(graph.tMin, 4)} to ${formatNumber(graph.tMax, 4)} ${settings.angleMode === "deg" ? "degrees" : "radians"}.`,
          );
        }
      }
    }

    if (graph.mode === "implicit") {
      const fn = graph.implicitFunction ? compiled.byId.get(graph.implicitFunction) : null;
      if (!fn) {
        notes.push("Choose a two-variable function, e.g. q(x, y) = x^2 + y^2 with level 25.");
      } else {
        const evaluate = makeEvaluator2D(
          compiled,
          fn.id,
          graph.implicitX,
          graph.implicitY,
          evaluatorOptions,
        );
        if (!evaluate) {
          notes.push(`${fn.def.signature} has an error.`);
        } else {
          const grid = sampleGrid(
            evaluate,
            graph.xMin,
            graph.xMax,
            graph.yMin,
            graph.yMax,
            Math.min(graph.surfaceResolution * 2, 150),
          );
          result.push({
            type: "contour",
            x: grid.x,
            y: grid.y,
            z: grid.z,
            name: `${fn.def.signature} = ${graph.implicitLevel}`,
            showscale: false,
            contours: {
              start: graph.implicitLevel,
              end: graph.implicitLevel,
              size: 1,
              coloring: "lines",
            },
            line: { color: fn.def.color, width: graph.lineWidth },
            hovertemplate: "x=%{x:.4g}<br>y=%{y:.4g}<br>value=%{z:.4g}<extra></extra>",
          });
          notes.push(
            `Implicit curve drawn where ${fn.def.signature.replace(/\(.*\)/, "")}(${graph.implicitX}, ${graph.implicitY}) = ${graph.implicitLevel} using marching-squares contours.`,
          );
        }
      }
    }

    if (graph.mode === "surface") {
      const fn = graph.surfaceFunction ? compiled.byId.get(graph.surfaceFunction) : null;
      if (!fn) {
        notes.push("Choose a function of two variables to render a 3D surface.");
      } else {
        const evaluate = makeEvaluator2D(
          compiled,
          fn.id,
          graph.surfaceX,
          graph.surfaceY,
          evaluatorOptions,
        );
        if (!evaluate) {
          notes.push(`${fn.def.signature} has an error.`);
        } else {
          const grid = sampleGrid(
            evaluate,
            graph.xMin,
            graph.xMax,
            graph.yMin,
            graph.yMax,
            graph.surfaceResolution,
          );
          result.push({
            type: "surface",
            x: grid.x,
            y: grid.y,
            z: grid.z,
            name: fn.def.signature,
            showscale: true,
            colorscale: "Viridis",
            contours: { z: { show: true, usecolormap: true, project: { z: true } } },
            hovertemplate: `${graph.surfaceX}=%{x:.4g}<br>${graph.surfaceY}=%{y:.4g}<br>z=%{z:.4g}<extra></extra>`,
          });
        }
      }
    }

    if (graph.showPoints && graph.points.length && graph.mode !== "surface") {
      result.push({
        type: "scatter",
        mode: "markers+text",
        name: "Points",
        x: graph.points.map((point) => point.x),
        y: graph.points.map((point) => point.y),
        text: graph.points.map((point) => point.label),
        textposition: "top center",
        marker: { color: isDark ? "#f8fafc" : "#0f172a", size: 8, symbol: "circle" },
        hovertemplate: "%{text}<br>(%{x:.6g}, %{y:.6g})<extra></extra>",
      });
    }

    if (graph.mode === "points" && !graph.points.length) {
      notes.push("Add coordinate points in the graph settings to plot a dataset.");
    }

    return { traces: result, warnings: notes, traceReadout: readout };
  }, [
    compiled,
    functions,
    graph,
    isDark,
    settings.angleMode,
    traceEnabled,
    traceX,
    values,
  ]);

  const layout = useMemo<PlotLayout>(() => {
    const gridColor = isDark ? "#1e293b" : "#e2e8f0";
    const zeroColor = isDark ? "#475569" : "#94a3b8";
    const fontColor = isDark ? "#cbd5e1" : "#334155";
    const background = isDark ? "#0b1220" : "#ffffff";

    const yRange = graph.autoY
      ? autoRange(
          traces
            .filter((trace) => trace.type === "scatter" && Array.isArray(trace.y))
            .map((trace) => ({
              x: (trace.x as number[]) ?? [],
              y: (trace.y as (number | null)[]) ?? [],
            })),
        )
      : { min: graph.yMin, max: graph.yMax };

    const base: PlotLayout = {
      autosize: true,
      margin: { l: 50, r: 20, t: 20, b: 40 },
      paper_bgcolor: background,
      plot_bgcolor: background,
      font: { color: fontColor, size: 11 },
      showlegend: graph.showLegend,
      legend: { orientation: "h", y: -0.18, bgcolor: "rgba(0,0,0,0)" },
      hovermode: "closest",
      uirevision: `${graph.mode}-${revision}`,
      dragmode: "pan",
    };

    if (graph.mode === "surface") {
      return {
        ...base,
        scene: {
          xaxis: { title: { text: graph.surfaceX }, gridcolor: gridColor, color: fontColor },
          yaxis: { title: { text: graph.surfaceY }, gridcolor: gridColor, color: fontColor },
          zaxis: { title: { text: "z" }, gridcolor: gridColor, color: fontColor },
          bgcolor: background,
        },
      };
    }

    return {
      ...base,
      xaxis: {
        title: {
          text:
            graph.mode === "cartesian"
              ? graph.axisVariable
              : graph.mode === "parametric" || graph.mode === "polar"
                ? "x"
                : graph.implicitX,
        },
        range: [graph.xMin, graph.xMax],
        showgrid: graph.showGrid,
        gridcolor: gridColor,
        zerolinecolor: zeroColor,
        zerolinewidth: 1.5,
        ticks: "outside",
        tickcolor: gridColor,
      },
      yaxis: {
        title: { text: graph.mode === "implicit" ? graph.implicitY : "y" },
        range: yRange ? [yRange.min, yRange.max] : undefined,
        showgrid: graph.showGrid,
        gridcolor: gridColor,
        zerolinecolor: zeroColor,
        zerolinewidth: 1.5,
        ticks: "outside",
        tickcolor: gridColor,
      },
    };
  }, [graph, isDark, revision, traces]);

  const exportImage = async (format: "png" | "svg") => {
    if (!plotElement.current) return;
    const Plotly = await import("plotly.js-dist-min");
    await Plotly.downloadImage(plotElement.current, {
      format,
      filename: `${workspace.name.replace(/[^\w-]+/g, "-").toLowerCase() || "graph"}`,
      width: 1200,
      height: 800,
    });
  };

  const functionOptions = functions.map((fn) => ({ id: fn.id, label: fn.signature }));

  return (
    <div className={cn("grid gap-4", showSettings ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "")}>
      <Card className="flex min-h-0 flex-col">
        <PanelHeading
          title="Graph explorer"
          description={MODE_LABELS[graph.mode]}
          actions={
            <>
              <Button size="sm" onClick={() => setRevision((value) => value + 1)}>
                Reset zoom
              </Button>
              <Button size="sm" onClick={() => void exportImage("png")}>
                PNG
              </Button>
              <Button size="sm" onClick={() => void exportImage("svg")}>
                SVG
              </Button>
              <Button
                size="sm"
                variant={showSettings ? "subtle" : "primary"}
                onClick={() => setShowSettings((open) => !open)}
                aria-expanded={showSettings}
              >
                {showSettings ? "Hide settings" : "Graph settings"}
              </Button>
            </>
          }
        />
        <div className="relative min-h-[420px] flex-1 p-2">
          <Plot
            data={traces}
            layout={layout}
            className="relative h-[420px] w-full sm:h-[520px]"
            onHover={setHover}
            onReady={(element) => {
              plotElement.current = element;
            }}
            ariaLabel={`${MODE_LABELS[graph.mode]} of ${functions.length} functions`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-2 text-xs dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {hover
              ? `${hover.name ? `${hover.name}: ` : ""}(${formatNumber(hover.x, 6)}, ${formatNumber(hover.y, 6)})`
              : "Hover the graph to read coordinates · drag to pan · scroll to zoom"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Toggle
              checked={traceEnabled}
              onChange={(checked) => {
                setTraceEnabled(checked);
                if (!checked) setFocusPoint(null);
              }}
              label="Toggle trace mode"
            />
            <span className="text-slate-500 dark:text-slate-400">Trace</span>
            {traceEnabled ? (
              <>
                <NumberInput
                  ariaLabel="Trace position"
                  value={traceX}
                  onCommit={setTraceX}
                  className="h-7 w-24 py-0.5 text-xs"
                />
                <input
                  type="range"
                  aria-label="Trace slider"
                  min={graph.xMin}
                  max={graph.xMax}
                  step={(graph.xMax - graph.xMin) / 400}
                  value={traceX}
                  onChange={(event) => setTraceX(Number(event.target.value))}
                  className="w-32"
                />
              </>
            ) : null}
          </div>
        </div>
        {traceEnabled && traceReadout.length ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-2 dark:border-slate-800">
            {traceReadout.map((item) => (
              <span
                key={item.name}
                className="mono flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-800"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                {item.name.replace(/\(.*\)/, "")}({formatNumber(traceX, 4)}) ={" "}
                {item.y === null ? "undefined" : formatNumber(item.y, settings.precision)}
              </span>
            ))}
          </div>
        ) : null}
        {warnings.length ? (
          <div className="space-y-1.5 px-4 py-2">
            {warnings.slice(0, 4).map((warning) => (
              <Alert key={warning} tone="warning">
                {warning}
              </Alert>
            ))}
          </div>
        ) : null}
      </Card>

      {showSettings ? (
        <Card className="h-fit">
          <PanelHeading title="Graph settings" description="Mode, axes, sampling and appearance." />
          <div className="space-y-3 px-4 py-3">
            <Field label="Graph mode" htmlFor="graph-mode">
              <Select
                id="graph-mode"
                value={graph.mode}
                onChange={(event) =>
                  dispatch({ type: "update-graph", patch: { mode: event.target.value as GraphMode } })
                }
              >
                {Object.entries(MODE_LABELS).map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            {graph.mode === "cartesian" ? (
              <Field
                label="Horizontal axis variable"
                hint="Every other variable is treated as a fixed parameter."
                htmlFor="axis-variable"
              >
                <Select
                  id="axis-variable"
                  value={graph.axisVariable}
                  onChange={(event) =>
                    dispatch({ type: "update-graph", patch: { axisVariable: event.target.value } })
                  }
                >
                  {(compiled.allVariables.length ? compiled.allVariables : ["x"]).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {graph.mode === "parametric" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="x(t)" htmlFor="param-x">
                  <Select
                    id="param-x"
                    value={graph.parametricX ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { parametricX: event.target.value || null },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {functionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="y(t)" htmlFor="param-y">
                  <Select
                    id="param-y"
                    value={graph.parametricY ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { parametricY: event.target.value || null },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {functionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Parameter name" htmlFor="param-var" className="col-span-2">
                  <input
                    id="param-var"
                    value={graph.paramVariable}
                    onChange={(event) =>
                      dispatch({ type: "update-graph", patch: { paramVariable: event.target.value } })
                    }
                    className="mono w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </Field>
              </div>
            ) : null}

            {graph.mode === "polar" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="r(θ) function" htmlFor="polar-fn" className="col-span-2">
                  <Select
                    id="polar-fn"
                    value={graph.polarFunction ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { polarFunction: event.target.value || null },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {functionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="θ variable" htmlFor="polar-var" className="col-span-2">
                  <input
                    id="polar-var"
                    value={graph.polarVariable}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { polarVariable: event.target.value },
                      })
                    }
                    className="mono w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </Field>
              </div>
            ) : null}

            {graph.mode === "implicit" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Function" htmlFor="implicit-fn" className="col-span-2">
                  <Select
                    id="implicit-fn"
                    value={graph.implicitFunction ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { implicitFunction: event.target.value || null },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {functionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level k" htmlFor="implicit-level">
                  <NumberInput
                    id="implicit-level"
                    value={graph.implicitLevel}
                    onCommit={(implicitLevel) =>
                      dispatch({ type: "update-graph", patch: { implicitLevel } })
                    }
                  />
                </Field>
                <Field label="Resolution" htmlFor="implicit-res">
                  <NumberInput
                    id="implicit-res"
                    value={graph.surfaceResolution}
                    onCommit={(surfaceResolution) =>
                      dispatch({
                        type: "update-graph",
                        patch: { surfaceResolution: Math.round(surfaceResolution) },
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {graph.mode === "surface" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="z = f(x, y)" htmlFor="surface-fn" className="col-span-2">
                  <Select
                    id="surface-fn"
                    value={graph.surfaceFunction ?? ""}
                    onChange={(event) =>
                      dispatch({
                        type: "update-graph",
                        patch: { surfaceFunction: event.target.value || null },
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {functionOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="x variable" htmlFor="surface-x">
                  <Select
                    id="surface-x"
                    value={graph.surfaceX}
                    onChange={(event) =>
                      dispatch({ type: "update-graph", patch: { surfaceX: event.target.value } })
                    }
                  >
                    {(compiled.allVariables.length ? compiled.allVariables : ["x"]).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="y variable" htmlFor="surface-y">
                  <Select
                    id="surface-y"
                    value={graph.surfaceY}
                    onChange={(event) =>
                      dispatch({ type: "update-graph", patch: { surfaceY: event.target.value } })
                    }
                  >
                    {(compiled.allVariables.length ? compiled.allVariables : ["y"]).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Grid resolution" htmlFor="surface-res" className="col-span-2">
                  <NumberInput
                    id="surface-res"
                    value={graph.surfaceResolution}
                    onCommit={(surfaceResolution) =>
                      dispatch({
                        type: "update-graph",
                        patch: { surfaceResolution: Math.round(surfaceResolution) },
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {graph.mode === "parametric" || graph.mode === "polar" ? (
              <div className="grid grid-cols-3 gap-2">
                <Field label="t min" htmlFor="t-min">
                  <NumberInput
                    id="t-min"
                    value={graph.tMin}
                    onCommit={(tMin) => dispatch({ type: "update-graph", patch: { tMin } })}
                  />
                </Field>
                <Field label="t max" htmlFor="t-max">
                  <NumberInput
                    id="t-max"
                    value={graph.tMax}
                    onCommit={(tMax) => dispatch({ type: "update-graph", patch: { tMax } })}
                  />
                </Field>
                <Field label="samples" htmlFor="t-samples">
                  <NumberInput
                    id="t-samples"
                    value={graph.tSamples}
                    onCommit={(tSamples) =>
                      dispatch({ type: "update-graph", patch: { tSamples: Math.round(tSamples) } })
                    }
                  />
                </Field>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Field label="x min" htmlFor="x-min">
                <NumberInput
                  id="x-min"
                  value={graph.xMin}
                  onCommit={(xMin) => dispatch({ type: "update-graph", patch: { xMin } })}
                />
              </Field>
              <Field label="x max" htmlFor="x-max">
                <NumberInput
                  id="x-max"
                  value={graph.xMax}
                  onCommit={(xMax) => dispatch({ type: "update-graph", patch: { xMax } })}
                />
              </Field>
              <Field label="y min" htmlFor="y-min">
                <NumberInput
                  id="y-min"
                  value={graph.yMin}
                  disabled={graph.autoY}
                  onCommit={(yMin) => dispatch({ type: "update-graph", patch: { yMin } })}
                />
              </Field>
              <Field label="y max" htmlFor="y-max">
                <NumberInput
                  id="y-max"
                  value={graph.yMax}
                  disabled={graph.autoY}
                  onCommit={(yMax) => dispatch({ type: "update-graph", patch: { yMax } })}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-2">
                <Toggle
                  checked={graph.autoY}
                  onChange={(autoY) => dispatch({ type: "update-graph", patch: { autoY } })}
                  label="Auto scale y axis"
                />
                Auto y-scale
              </label>
              <label className="flex items-center gap-2">
                <Toggle
                  checked={graph.showGrid}
                  onChange={(showGrid) => dispatch({ type: "update-graph", patch: { showGrid } })}
                  label="Show grid"
                />
                Grid
              </label>
              <label className="flex items-center gap-2">
                <Toggle
                  checked={graph.showLegend}
                  onChange={(showLegend) => dispatch({ type: "update-graph", patch: { showLegend } })}
                  label="Show legend"
                />
                Legend
              </label>
              <label className="flex items-center gap-2">
                <Toggle
                  checked={graph.showPoints}
                  onChange={(showPoints) => dispatch({ type: "update-graph", patch: { showPoints } })}
                  label="Show plotted points"
                />
                Points
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Samples" htmlFor="samples" hint="25 – 4000">
                <NumberInput
                  id="samples"
                  value={graph.samples}
                  onCommit={(samples) =>
                    dispatch({ type: "update-graph", patch: { samples: Math.round(samples) } })
                  }
                />
              </Field>
              <Field label="Graph theme" htmlFor="graph-theme">
                <Select
                  id="graph-theme"
                  value={graph.theme}
                  onChange={(event) =>
                    dispatch({
                      type: "update-graph",
                      patch: { theme: event.target.value as "auto" | "light" | "dark" },
                    })
                  }
                >
                  <option value="auto">Match app theme</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
            </div>

            <div className="space-y-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Plotted points
                </span>
                <Button size="sm" onClick={() => dispatch({ type: "add-point" })}>
                  + Point
                </Button>
              </div>
              {graph.points.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  No points yet. Points are useful for datasets or marking solutions.
                </p>
              ) : null}
              {graph.points.map((point) => (
                <div key={point.id} className="flex items-center gap-1.5">
                  <input
                    aria-label="Point label"
                    value={point.label}
                    onChange={(event) =>
                      dispatch({
                        type: "update-point",
                        id: point.id,
                        patch: { label: event.target.value },
                      })
                    }
                    className="h-7 w-16 rounded-md border border-slate-300 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <NumberInput
                    ariaLabel="Point x"
                    value={point.x}
                    onCommit={(x) => dispatch({ type: "update-point", id: point.id, patch: { x } })}
                    className="h-7 py-0.5 text-xs"
                  />
                  <NumberInput
                    ariaLabel="Point y"
                    value={point.y}
                    onCommit={(y) => dispatch({ type: "update-point", id: point.id, patch: { y } })}
                    className="h-7 py-0.5 text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove point"
                    onClick={() => dispatch({ type: "remove-point", id: point.id })}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {functions.map((fn) => (
                <button
                  key={fn.id}
                  type="button"
                  onClick={() =>
                    dispatch({ type: "update-function", id: fn.id, patch: { visible: !fn.visible } })
                  }
                  className={cn(
                    "mono flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                    fn.visible
                      ? "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      : "border-dashed border-slate-300 text-slate-400 dark:border-slate-700",
                  )}
                  aria-pressed={fn.visible}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: fn.visible ? fn.color : "transparent", border: `1px solid ${fn.color}` }}
                  />
                  {fn.signature}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <Badge tone="info">Angle mode: {settings.angleMode === "deg" ? "degrees" : "radians"}</Badge>{" "}
              applies to every trigonometric evaluation on the graph.
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
