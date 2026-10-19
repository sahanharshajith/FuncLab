"use client";

import { useEffect, useRef, useState } from "react";
import type { PlotLayout, PlotTrace, PlotlyHTMLElement } from "plotly.js-dist-min";
import { Spinner } from "@/components/ui/primitives";

type PlotlyModule = typeof import("plotly.js-dist-min");

let plotlyPromise: Promise<PlotlyModule> | null = null;

function loadPlotly(): Promise<PlotlyModule> {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min");
  }
  return plotlyPromise;
}

export interface HoverPoint {
  x: number;
  y: number;
  name: string;
}

interface PlotProps {
  data: PlotTrace[];
  layout: PlotLayout;
  className?: string;
  onHover?: (point: HoverPoint | null) => void;
  onReady?: (element: HTMLElement) => void;
  ariaLabel?: string;
}

export function Plot({ data, layout, className, onHover, onReady, ariaLabel }: PlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<PlotlyHTMLElement | null>(null);
  const hoverRef = useRef(onHover);
  const readyRef = useRef(onReady);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hoverRef.current = onHover;
    readyRef.current = onReady;
  }, [onHover, onReady]);

  useEffect(() => {
    let cancelled = false;
    const node = containerRef.current;
    if (!node) return;

    loadPlotly()
      .then((Plotly) => {
        if (cancelled || !containerRef.current) return;
        return Plotly.react(containerRef.current, data, layout, {
          displayModeBar: true,
          responsive: true,
          displaylogo: false,
          scrollZoom: true,
          modeBarButtonsToRemove: ["sendDataToCloud", "toImage"],
        }).then((element) => {
          if (cancelled) return;
          plotRef.current = element;
          setLoading(false);
          setError(null);
          readyRef.current?.(element);
          element.removeAllListeners?.("plotly_hover");
          element.removeAllListeners?.("plotly_unhover");
          element.on("plotly_hover", (event) => {
            const point = event.points?.[0];
            if (!point) return;
            const x = typeof point.x === "number" ? point.x : Number(point.x);
            const y = typeof point.y === "number" ? point.y : Number(point.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            hoverRef.current?.({ x, y, name: point.data?.name ?? "" });
          });
          element.on("plotly_unhover", () => hoverRef.current?.(null));
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoading(false);
        setError(cause instanceof Error ? cause.message : "Could not load the plotting library.");
      });

    return () => {
      cancelled = true;
    };
  }, [data, layout]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!plotRef.current) return;
      void loadPlotly().then((Plotly) => {
        if (plotRef.current) Plotly.Plots.resize(plotRef.current);
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    return () => {
      if (!node) return;
      void loadPlotly().then((Plotly) => Plotly.purge(node));
    };
  }, []);

  return (
    <div className={className} role="img" aria-label={ariaLabel ?? "Function graph"}>
      <div ref={containerRef} className="h-full w-full" />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Spinner /> Loading graph engine…
        </div>
      ) : null}
      {error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  );
}
