"use client";

import { useMemo, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { BUILTIN_FUNCTIONS, CONSTANT_NAMES } from "@/lib/math/engine";
import type { AngleMode, NumberNotation } from "@/lib/types";
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
} from "@/components/ui/primitives";

export function SettingsView() {
  const { workspace, dispatch, theme, setTheme, setOnboardingOpen } = useWorkspaceStore();
  const settings = workspace.data.settings;
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, typeof BUILTIN_FUNCTIONS>();
    for (const fn of BUILTIN_FUNCTIONS) {
      if (filter && !`${fn.name} ${fn.description}`.toLowerCase().includes(filter.toLowerCase())) {
        continue;
      }
      map.set(fn.category, [...(map.get(fn.category) ?? []), fn]);
    }
    return [...map.entries()];
  }, [filter]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-fit">
        <PanelHeading
          title="Calculation settings"
          description="These preferences are stored with the workspace."
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="Angle mode" htmlFor="angle-mode" hint="Applies to sin, cos, tan and inverses.">
            <Select
              id="angle-mode"
              value={settings.angleMode}
              onChange={(event) =>
                dispatch({
                  type: "update-settings",
                  patch: { angleMode: event.target.value as AngleMode },
                })
              }
            >
              <option value="rad">Radians (default)</option>
              <option value="deg">Degrees</option>
            </Select>
          </Field>
          <Field label="Display precision" htmlFor="precision" hint="Significant digits / decimals.">
            <NumberInput
              id="precision"
              value={settings.precision}
              onCommit={(precision) =>
                dispatch({
                  type: "update-settings",
                  patch: { precision: Math.max(0, Math.min(15, Math.round(precision))) },
                })
              }
            />
          </Field>
          <Field label="Number notation" htmlFor="notation">
            <Select
              id="notation"
              value={settings.notation}
              onChange={(event) =>
                dispatch({
                  type: "update-settings",
                  patch: { notation: event.target.value as NumberNotation },
                })
              }
            >
              <option value="auto">Auto</option>
              <option value="fixed">Fixed decimals</option>
              <option value="exponential">Scientific</option>
            </Select>
          </Field>
          <Field label="Appearance" htmlFor="theme-select">
            <Select
              id="theme-select"
              value={theme}
              onChange={(event) => setTheme(event.target.value as "light" | "dark")}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Toggle
              checked={settings.autoCalculate}
              onChange={(autoCalculate) =>
                dispatch({ type: "update-settings", patch: { autoCalculate } })
              }
              label="Automatic recalculation"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Recalculate automatically while typing
            </span>
          </div>
        </div>
        <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <Button size="sm" onClick={() => setOnboardingOpen(true)}>
            Replay the getting started guide
          </Button>
        </div>
      </Card>

      <Card className="h-fit">
        <PanelHeading
          title="Storage & privacy"
          description="Your workspace stays in this browser tab session."
        />
        <div className="space-y-3 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
          <p>
            <strong>Session storage:</strong> workspaces, preferences, and history stay in this
            browser tab. They are available after a page refresh and are cleared when the tab
            session ends.
          </p>
          <p>
            <strong>Calculations:</strong> expressions are evaluated in your browser. FuncLab does
            not send your workspace or history to a database.
          </p>
          <Alert tone="info">Export a workspace as JSON if you want to keep a copy after closing this tab.</Alert>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <PanelHeading
          title="Supported functions & constants"
          description="Identifiers below are reserved — they are never detected as user variables."
          actions={
            <input
              aria-label="Filter functions"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter…"
              className="h-8 w-40 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          }
        />
        <div className="space-y-4 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Constants:</span>
            {CONSTANT_NAMES.filter((name) => !["true", "false", "null", "undefined"].includes(name)).map(
              (name) => (
                <Badge key={name} tone="info">
                  {name}
                </Badge>
              ),
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {category}
                </h3>
                <ul className="space-y-1">
                  {items.map((fn) => (
                    <li key={fn.name} className="text-xs">
                      <code className="mono text-slate-800 dark:text-slate-100">{fn.signature}</code>
                      <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                        {fn.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            <p className="font-medium">Syntax notes</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>
                Implicit multiplication works between a number and a name or bracket:{" "}
                <code className="mono">2x</code>, <code className="mono">3(x+1)</code>. Two adjacent
                names (<code className="mono">xy</code>) are read as one variable.
              </li>
              <li>
                Operators: <code className="mono">+ - * / % ^ mod !</code> with standard precedence;
                comparisons and <code className="mono">cond ? a : b</code> for piecewise definitions.
              </li>
              <li>
                Reference other functions by name once they are defined:{" "}
                <code className="mono">h(x) = f(x) + g(x)</code>. Circular references are detected.
              </li>
              <li>Assignments, ranges, loops and property access are blocked for safety.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
