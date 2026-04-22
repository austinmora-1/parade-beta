import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeShort } from '@/lib/lastSync';

interface LastSyncedIndicatorProps {
  /** ISO timestamp of the last successful sync, or null if never synced. */
  syncedAt: string | null;
  /** When true, show a subtle "Syncing…" state instead of the timestamp. */
  isSyncing?: boolean;
}

/**
 * Compact "Last synced X ago" label with a tooltip revealing the exact local time.
 * Re-renders every 30s so the relative time stays fresh.
 */
export function LastSyncedIndicator({ syncedAt, isSyncing }: LastSyncedIndicatorProps) {
  const [, force] = useState(0);

  // Tick every 30s so "5m ago" updates without manual refresh.
  useEffect(() => {
    if (!syncedAt) return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [syncedAt]);

  if (isSyncing) {
    return (
      <span className="text-[10px] text-muted-foreground">Syncing…</span>
    );
  }

  if (!syncedAt) {
    return (
      <span className="text-[10px] text-muted-foreground">Never synced</span>
    );
  }

  const exact = new Date(syncedAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2">
            Last synced {formatRelativeShort(syncedAt)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {exact}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
