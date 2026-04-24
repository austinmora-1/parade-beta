import { useState } from 'react';
import { Sparkles, Clock, ChevronRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOpenWindows, type OpenWindow } from '@/hooks/useOpenWindows';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import type { TimeSlot } from '@/types/planner';

interface FindOtherTimesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindOtherTimesDialog({ open, onOpenChange }: FindOtherTimesDialogProps) {
  const { windows, loading } = useOpenWindows();
  const [planFor, setPlanFor] = useState<OpenWindow | null>(null);

  // Sort: soonest first
  const sorted = [...windows].sort((a, b) => a.date.getTime() - b.date.getTime());

  const handlePick = (w: OpenWindow) => {
    onOpenChange(false);
    // Slight delay so the dialog closes cleanly before sheet opens
    setTimeout(() => setPlanFor(w), 200);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 font-display text-xl">
              <Sparkles className="h-4 w-4 text-primary" />
              Find other times
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pick a window — then choose friends and an activity.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-6">Loading…</p>
            )}
            {!loading && sorted.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No open windows in the next few days.
                </p>
              </div>
            )}
            {!loading && sorted.map((w) => (
              <WindowRow
                key={w.date.toISOString() + w.slots[0]}
                window={w}
                onClick={() => handlePick(w)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {planFor && (
        <QuickPlanSheet
          open={!!planFor}
          onOpenChange={(v) => !v && setPlanFor(null)}
          preSelectedDate={planFor.date}
          preSelectedTimeSlot={planFor.slots[0] as TimeSlot}
        />
      )}
    </>
  );
}

function WindowRow({
  window: w,
  onClick,
}: {
  window: OpenWindow;
  onClick: () => void;
}) {
  const friendCount = w.overlappingFriends.length;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-soft hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {w.dayLabel}
        </p>
        <p className="font-display text-base font-semibold leading-tight mt-0.5">
          {w.startLabel}–{w.endLabel}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 min-h-[20px]">
          {friendCount > 0 ? (
            <>
              <div className="flex -space-x-1.5">
                {w.overlappingFriends.slice(0, 3).map((f) => (
                  <Avatar key={f.userId} className="h-5 w-5 ring-1 ring-card">
                    {f.avatar && <AvatarImage src={f.avatar} alt={f.name} />}
                    <AvatarFallback className="text-[9px]">
                      {f.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {friendCount} free
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">{w.hours}hr free</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
