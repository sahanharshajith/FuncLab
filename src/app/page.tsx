"use client";

import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { UiProvider } from "@/lib/ui-context";
import { WorkspaceProvider } from "@/lib/workspace/store";

export default function HomePage() {
  return (
    <ErrorBoundary label="FuncLab">
      <WorkspaceProvider>
        <UiProvider>
          <AppShell />
        </UiProvider>
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
