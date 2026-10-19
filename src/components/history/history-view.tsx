"use client";

import { useWorkspaceStore } from "@/lib/workspace/store";
import { Badge, Button, Card, EmptyState, PanelHeading } from "@/components/ui/primitives";
import { History } from "lucide-react";

export function HistoryView() {
  const { history, clearHistory } = useWorkspaceStore();

  return (
    <Card>
      <PanelHeading
        title="Calculation history"
        description="Recent calculator and analysis results from this browser tab session."
        actions={
          <Button size="sm" variant="danger" onClick={() => void clearHistory()} disabled={!history.length}>
            Clear history
          </Button>
        }
      />
      {history.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<History size={22} aria-hidden="true" />}
            title="No calculations yet"
            description="Use the scientific calculator or the analysis tools and your results will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
              <Badge tone="neutral">{item.kind}</Badge>
              <span className="mono min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                {item.expression}
              </span>
              <span className="mono font-semibold text-slate-900 dark:text-slate-100">
                {item.result}
              </span>
              <span className="w-full text-[11px] text-slate-400 sm:w-auto">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
