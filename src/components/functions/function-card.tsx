"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Settings2, Trash2 } from "lucide-react";
import type {
  FunctionDef,
  FunctionEvaluation,
  VariableConfig,
  WorkspaceSettings,
} from "@/lib/types";
import { formatNumber } from "@/lib/math/format";
import { FUNCTION_COLORS } from "@/lib/workspace/defaults";
import type { WorkspaceAction } from "@/lib/workspace/reducer";
import {
  Badge,
  Button,
  Card,
  NumberInput,
  TextInput,
  Toggle,
  cn,
} from "@/components/ui/primitives";

interface Props {
  def: FunctionDef;
  evaluation: FunctionEvaluation | undefined;
  variables: Map<string, VariableConfig>;
  settings: WorkspaceSettings;
  index: number;
  total: number;
  dispatch: (action: WorkspaceAction) => void;
}

export function FunctionCard({
  def,
  evaluation,
  variables,
  settings,
  index,
  total,
  dispatch,
}: Props) {
  const [showOptions, setShowOptions] = useState(false);
  const hasError = Boolean(evaluation?.error);
  const disabled = def.enabled === false;

  const update = (patch: Partial<FunctionDef>) =>
    dispatch({ type: "update-function", id: def.id, patch });

  return (
    <Card
      as="article"
      className={cn(
        "overflow-hidden transition-colors",
        hasError && !disabled && "border-red-300 dark:border-red-900",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
        <span
          className="h-4 w-4 flex-shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: def.color }}
          aria-hidden
        />
        <input
          aria-label={`Signature of function ${index + 1}`}
          value={def.signature}
          onChange={(event) => update({ signature: event.target.value })}
          spellCheck={false}
          className="mono w-28 shrink-0 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 hover:border-slate-300 focus:border-blue-500 focus:outline-none dark:text-slate-100 dark:hover:border-slate-700"
        />
        <span className="text-slate-400">=</span>
        <input
          aria-label={`Expression of function ${index + 1}`}
          value={def.expression}
          placeholder="e.g. x^2 + 2*x + 1"
          onChange={(event) => update({ expression: event.target.value })}
          spellCheck={false}
          className="mono min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none dark:text-slate-100 dark:hover:border-slate-700"
        />
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={def.visible ? "Hide on graph" : "Show on graph"}
            title={def.visible ? "Hide on graph" : "Show on graph"}
            onClick={() => update({ visible: !def.visible })}
          >
            {def.visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Function options"
            title="Options"
            aria-expanded={showOptions}
            onClick={() => setShowOptions((open) => !open)}
          >
            <Settings2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-500 dark:text-slate-400">Result</span>
          <span
            className={cn(
              "mono rounded-md px-2 py-1 text-sm font-semibold",
              hasError
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
            )}
          >
            {disabled
              ? "disabled"
              : evaluation && evaluation.value !== null
                ? formatNumber(evaluation.value, settings.precision, settings.notation)
                : (evaluation?.display ?? "—")}
          </span>
          {evaluation?.dependencies.length ? (
            <Badge tone="info">uses {evaluation.dependencies.join(", ")}</Badge>
          ) : null}
          {def.group ? <Badge tone="neutral">{def.group}</Badge> : null}
          {evaluation?.variables.length === 0 && !hasError ? (
            <Badge tone="neutral">constant</Badge>
          ) : null}
        </div>

        {evaluation?.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {evaluation.error}
          </p>
        ) : null}

        {evaluation && evaluation.variables.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Detected variables
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {evaluation.variables.map((name) => {
                const overridden = Object.prototype.hasOwnProperty.call(def.overrides, name);
                const shared = variables.get(name);
                const value = overridden ? def.overrides[name] : (shared?.value ?? 0);
                return (
                  <div
                    key={name}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="mono w-16 shrink-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {name}
                      </span>
                      <NumberInput
                        ariaLabel={`Value of ${name} for ${def.signature}`}
                        value={value}
                        onCommit={(next) =>
                          overridden
                            ? dispatch({
                                type: "set-override",
                                id: def.id,
                                variable: name,
                                value: next,
                              })
                            : dispatch({
                                type: "update-variable",
                                name,
                                patch: { value: next },
                              })
                        }
                        className="h-7 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "set-override",
                            id: def.id,
                            variable: name,
                            value: overridden ? null : value,
                          })
                        }
                        title={
                          overridden
                            ? "Use the shared workspace value"
                            : "Override this variable for this function only"
                        }
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase transition-colors",
                          overridden
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400",
                        )}
                      >
                        {overridden ? "local" : "shared"}
                      </button>
                    </div>
                    {shared?.useSlider && !overridden ? (
                      <input
                        type="range"
                        aria-label={`${name} slider`}
                        min={shared.min}
                        max={shared.max}
                        step={shared.step}
                        value={value}
                        onChange={(event) =>
                          dispatch({
                            type: "update-variable",
                            name,
                            patch: { value: Number(event.target.value) },
                          })
                        }
                        className="mt-1 w-full"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {showOptions ? (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Colour</span>
                <div className="flex gap-1">
                  {FUNCTION_COLORS.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Use colour ${color}`}
                      onClick={() => update({ color })}
                      className={cn(
                        "h-5 w-5 rounded-full border-2",
                        def.color === color ? "border-slate-900 dark:border-white" : "border-transparent",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom colour"
                    value={def.color}
                    onChange={(event) => update({ color: event.target.value })}
                    className="h-5 w-6 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-700"
                  />
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                Group
                <TextInput
                  value={def.group}
                  onChange={(event) => update({ group: event.target.value })}
                  className="h-7 w-32 py-0.5 text-xs"
                />
              </label>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                Enabled
                <Toggle
                  checked={def.enabled}
                  onChange={(checked) => update({ enabled: checked })}
                  label="Enable function"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => dispatch({ type: "move-function", id: def.id, direction: -1 })}
                disabled={index === 0}
              >
                <ChevronUp size={14} aria-hidden="true" /> Move up
              </Button>
              <Button
                size="sm"
                onClick={() => dispatch({ type: "move-function", id: def.id, direction: 1 })}
                disabled={index === total - 1}
              >
                <ChevronDown size={14} aria-hidden="true" /> Move down
              </Button>
              <Button size="sm" onClick={() => dispatch({ type: "duplicate-function", id: def.id })}>
                <Copy size={14} aria-hidden="true" /> Duplicate
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => dispatch({ type: "remove-function", id: def.id })}
              >
                <Trash2 size={14} aria-hidden="true" /> Delete
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
