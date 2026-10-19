"use client";

import { useMemo, useRef, useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { compileExpression, evaluateCompiled, friendlyEvaluationError } from "@/lib/math/engine";
import { createWorkspaceScope } from "@/lib/math/workspace-eval";
import { formatNumber } from "@/lib/math/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  PanelHeading,
  cn,
} from "@/components/ui/primitives";

const KEYS: { label: string; insert?: string; action?: "clear" | "back" | "equals" }[] = [
  { label: "C", action: "clear" },
  { label: "⌫", action: "back" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "^", insert: "^" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "÷", insert: "/" },
  { label: "sqrt", insert: "sqrt(" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "×", insert: "*" },
  { label: "abs", insert: "abs(" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "−", insert: "-" },
  { label: "ln", insert: "log(" },
  { label: "0", insert: "0" },
  { label: ".", insert: "." },
  { label: "e", insert: "e" },
  { label: "+", insert: "+" },
  { label: "log10", insert: "log10(" },
  { label: "pi", insert: "pi" },
  { label: "sin", insert: "sin(" },
  { label: "cos", insert: "cos(" },
  { label: "tan", insert: "tan(" },
  { label: "=", action: "equals" },
];

export function CalculatorView() {
  const { workspace, dispatch, compiled, values, addHistory, history } = useWorkspaceStore();
  const settings = workspace.data.settings;
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ans, setAns] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scope = useMemo(
    () => createWorkspaceScope(compiled, { angleMode: settings.angleMode, values }),
    [compiled, settings.angleMode, values],
  );

  const evaluate = () => {
    if (!expression.trim()) return;
    try {
      const compiledExpression = compileExpression(expression);
      const outcome = evaluateCompiled(compiledExpression, { ...scope, ans: ans ?? 0 });
      if (outcome.error && outcome.value === null) {
        setError(outcome.error);
        setResult(null);
        return;
      }
      const display =
        outcome.value !== null
          ? formatNumber(outcome.value, settings.precision, settings.notation)
          : outcome.display;
      setResult(display);
      setError(outcome.error);
      if (outcome.value !== null) setAns(outcome.value);
      void addHistory({ kind: "calculator", expression, result: display });
    } catch (cause) {
      setError(friendlyEvaluationError(cause));
      setResult(null);
    }
  };

  const insert = (text: string) => {
    setExpression((current) => current + text);
    inputRef.current?.focus();
  };

  const recent = history.filter((item) => item.kind === "calculator").slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card>
        <PanelHeading
          title="Scientific calculator"
          description="Shares the workspace scope: use your variables, and call your functions such as f(2)."
          actions={
            <Badge tone="info">{settings.angleMode === "deg" ? "Degrees" : "Radians"}</Badge>
          }
        />
        <div className="space-y-3 px-4 py-4">
          <label htmlFor="calc-input" className="sr-only">
            Expression
          </label>
          <input
            id="calc-input"
            ref={inputRef}
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") evaluate();
            }}
            placeholder="2*pi*sin(pi/4) + f(3)"
            spellCheck={false}
            className="mono w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="flex min-h-[2.5rem] items-center justify-end rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <span className="mono text-xl font-semibold text-slate-900 dark:text-slate-100">
              {result ?? "—"}
            </span>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="grid grid-cols-5 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key.label}
                type="button"
                onClick={() => {
                  if (key.action === "clear") {
                    setExpression("");
                    setResult(null);
                    setError(null);
                  } else if (key.action === "back") {
                    setExpression((current) => current.slice(0, -1));
                  } else if (key.action === "equals") {
                    evaluate();
                  } else if (key.insert) {
                    insert(key.insert);
                  }
                }}
                className={cn(
                  "mono rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors",
                  key.action === "equals"
                    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-500"
                    : key.action
                      ? "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
              >
                {key.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Shortcuts:</span>
            <button
              type="button"
              className="mono rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800"
              onClick={() => insert("ans")}
            >
              ans
            </button>
            {workspace.data.functions.slice(0, 5).map((fn) => (
              <button
                key={fn.id}
                type="button"
                className="mono rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800"
                onClick={() => insert(`${fn.signature.replace(/\(.*\)/, "")}(`)}
              >
                {fn.signature}
              </button>
            ))}
            {workspace.data.variables.slice(0, 6).map((variable) => (
              <button
                key={variable.id}
                type="button"
                className="mono rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800"
                onClick={() => insert(variable.name)}
              >
                {variable.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="h-fit">
        <PanelHeading
          title="Recent calculations"
          description="Calculation history is kept for this browser tab session."
        />
        <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
              Nothing calculated yet.
            </p>
          ) : null}
          {recent.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setExpression(item.expression)}
              className="flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="mono truncate text-slate-600 dark:text-slate-300">
                {item.expression}
              </span>
              <span className="mono font-semibold text-slate-900 dark:text-slate-100">
                = {item.result}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              dispatch({
                type: "add-function",
                preset: { expression: expression || "x", signature: "f(x)" },
              })
            }
            disabled={!expression.trim()}
          >
            Save as function
          </Button>
        </div>
      </Card>
    </div>
  );
}
