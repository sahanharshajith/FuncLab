"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/workspace/store";
import { useUi, type ViewId } from "@/lib/ui-context";
import { Button } from "@/components/ui/primitives";

interface Step {
  title: string;
  body: string;
  example?: string;
  view?: ViewId;
}

const STEPS: Step[] = [
  {
    title: "Welcome to FuncLab",
    body: "Define mathematical functions, evaluate them instantly and explore them visually. Everything works without an account — your workspace is saved in this browser.",
    example: "f(x) = x^2 - 4",
  },
  {
    title: "1 · Add a function",
    body: "Each card has a signature and an expression. Type the expression and FuncLab parses it with a safe math engine (never eval).",
    example: "g(x, y) = x^2 + 2*y - sin(x)",
    view: "functions",
  },
  {
    title: "2 · Variables appear automatically",
    body: "Variables are detected from your expression. Constants (pi, e) and built-in functions (sin, log…) are never mistaken for variables. Adjust values with inputs or sliders, or override a value for a single function.",
    example: "theta, velocity and temperature are all valid variable names",
    view: "functions",
  },
  {
    title: "3 · Compare and reuse functions",
    body: "Functions share variables by default, and one function can reference another once it is defined. Circular references are detected and explained.",
    example: "h(x) = f(x) + g(x)",
    view: "functions",
  },
  {
    title: "4 · Plot it",
    body: "The graph explorer supports 2D cartesian, parametric, polar, implicit, 3D surface and point plots. Choose which variable is on the x-axis; the others stay fixed parameters.",
    example: "Graph q(x, y) = x^2 + y^2 against x with y = 3",
    view: "graph",
  },
  {
    title: "5 · Tables, tools and saving",
    body: "Generate value tables with CSV export and use the numerical analysis tools. Export a workspace as JSON if you want to keep it after this tab session.",
    example: "f(x) = x^2 from -5 to 5 step 1",
    view: "table",
  },
];

export function Onboarding() {
  const { onboardingOpen, setOnboardingOpen } = useWorkspaceStore();
  const { setView } = useUi();
  const [step, setStep] = useState(0);

  if (!onboardingOpen) return null;
  const current = STEPS[step];

  const close = () => {
    setOnboardingOpen(false);
    setStep(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="animate-fade-in w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <h2
            id="onboarding-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {current.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close guide"
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{current.body}</p>
        {current.example ? (
          <p className="mono mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {current.example}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((item, index) => (
              <span
                key={item.title}
                className={`h-1.5 w-6 rounded-full ${
                  index === step ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={close}>
              Skip
            </Button>
            {step > 0 ? (
              <Button size="sm" onClick={() => setStep((value) => value - 1)}>
                Back
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const next = STEPS[step + 1];
                if (!next) {
                  close();
                  return;
                }
                if (next.view) setView(next.view);
                setStep((value) => value + 1);
              }}
            >
              {step === STEPS.length - 1 ? "Start calculating" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
