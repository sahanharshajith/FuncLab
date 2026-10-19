"use client";

import { useState } from "react";
import type { VariableConfig } from "@/lib/types";
import type { WorkspaceAction } from "@/lib/workspace/reducer";
import {
  Badge,
  Button,
  Card,
  NumberInput,
  PanelHeading,
  Toggle,
  cn,
} from "@/components/ui/primitives";

interface Props {
  variables: VariableConfig[];
  usedVariables: string[];
  axisVariable: string;
  dispatch: (action: WorkspaceAction) => void;
}

export function VariablesPanel({ variables, usedVariables, axisVariable, dispatch }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const used = new Set(usedVariables);
  const unusedCount = variables.filter((variable) => !used.has(variable.name)).length;

  return (
    <Card>
      <PanelHeading
        title="Shared variables"
        description="Values are shared by every function unless a function overrides them."
        actions={
          <>
            <Button size="sm" onClick={() => dispatch({ type: "reset-variables" })}>
              Reset defaults
            </Button>
            {unusedCount > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "prune-variables" })}>
                Clear {unusedCount} unused
              </Button>
            ) : null}
          </>
        }
      />
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {variables.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Variables appear automatically as soon as your expressions use them.
          </p>
        ) : null}
        {variables.map((variable) => {
          const isUsed = used.has(variable.name);
          const isAxis = variable.name === axisVariable;
          const open = expanded === variable.name;
          return (
            <div key={variable.id} className={cn("px-4 py-2.5", !isUsed && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono w-20 shrink-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {variable.name}
                </span>
                <NumberInput
                  ariaLabel={`Value of ${variable.name}`}
                  value={variable.value}
                  onCommit={(value) =>
                    dispatch({ type: "update-variable", name: variable.name, patch: { value } })
                  }
                  className="h-8 w-28"
                />
                {isAxis ? (
                  <Badge tone="info" className="shrink-0">
                    graph axis
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="shrink-0">
                    parameter
                  </Badge>
                )}
                {!isUsed ? <Badge tone="warning">unused</Badge> : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Configure ${variable.name}`}
                    title="Slider range and step"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : variable.name)}
                  >
                    ⋯
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${variable.name}`}
                    title="Remove variable"
                    onClick={() => dispatch({ type: "remove-variable", name: variable.name })}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              {variable.useSlider ? (
                <input
                  type="range"
                  aria-label={`${variable.name} slider`}
                  min={variable.min}
                  max={variable.max}
                  step={variable.step}
                  value={variable.value}
                  onChange={(event) =>
                    dispatch({
                      type: "update-variable",
                      name: variable.name,
                      patch: { value: Number(event.target.value) },
                    })
                  }
                  className="mt-2 w-full"
                />
              ) : null}

              {open ? (
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/50 sm:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400">Min</span>
                    <NumberInput
                      ariaLabel={`${variable.name} minimum`}
                      value={variable.min}
                      onCommit={(min) =>
                        dispatch({ type: "update-variable", name: variable.name, patch: { min } })
                      }
                      className="h-7 py-0.5 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400">Max</span>
                    <NumberInput
                      ariaLabel={`${variable.name} maximum`}
                      value={variable.max}
                      onCommit={(max) =>
                        dispatch({ type: "update-variable", name: variable.name, patch: { max } })
                      }
                      className="h-7 py-0.5 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400">Step</span>
                    <NumberInput
                      ariaLabel={`${variable.name} step`}
                      value={variable.step}
                      onCommit={(step) =>
                        dispatch({ type: "update-variable", name: variable.name, patch: { step } })
                      }
                      className="h-7 py-0.5 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-slate-500 dark:text-slate-400">Default</span>
                    <NumberInput
                      ariaLabel={`${variable.name} default value`}
                      value={variable.defaultValue}
                      onCommit={(defaultValue) =>
                        dispatch({
                          type: "update-variable",
                          name: variable.name,
                          patch: { defaultValue },
                        })
                      }
                      className="h-7 py-0.5 text-xs"
                    />
                  </label>
                  <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
                    <Toggle
                      checked={variable.useSlider}
                      onChange={(useSlider) =>
                        dispatch({
                          type: "update-variable",
                          name: variable.name,
                          patch: { useSlider },
                        })
                      }
                      label={`Toggle slider for ${variable.name}`}
                    />
                    <span className="text-slate-500 dark:text-slate-400">Show slider</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() =>
                        dispatch({
                          type: "update-variable",
                          name: variable.name,
                          patch: { value: variable.defaultValue },
                        })
                      }
                    >
                      Reset to default
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
