"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ViewId =
  | "functions"
  | "graph"
  | "table"
  | "calculator"
  | "tools"
  | "workspaces"
  | "history"
  | "settings";

export interface FocusPoint {
  x: number;
  label?: string;
}

interface UiContextValue {
  view: ViewId;
  setView: (view: ViewId) => void;
  focusPoint: FocusPoint | null;
  setFocusPoint: (point: FocusPoint | null) => void;
  inspectPoint: (x: number, label?: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("functions");
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const inspectPoint = useCallback((x: number, label?: string) => {
    setFocusPoint({ x, label });
    setView("graph");
  }, []);

  const value = useMemo(
    () => ({
      view,
      setView,
      focusPoint,
      setFocusPoint,
      inspectPoint,
      sidebarOpen,
      setSidebarOpen,
    }),
    [view, focusPoint, inspectPoint, sidebarOpen],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi must be used inside <UiProvider>");
  return context;
}
