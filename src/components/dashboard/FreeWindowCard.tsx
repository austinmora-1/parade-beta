import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { useOpenWindows, type OpenWindow } from '@/hooks/useOpenWindows';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import type { TimeSlot } from '@/types/planner';
import { cn } from '@/lib/utils';

export function FreeWindowCard() {
  const { windows, loading } = useOpenWindows();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [planFor, setPlanFor] = useState<OpenWindow | null>(null);
  const [highlight, setHighlight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for global "expand free weekend" event (from FAB → Free weekend entry)
  useEffect(() => {
    const handler = () => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlight(true);
      window.setTimeout(() => setHighlight(false), 1800);
    };
    window.addEventListener('parade:expand-free-window', handler);
    return () => window.removeEventListener('parade:expand-free-window', handler);
  }, []);

  if (loading) return null;

  // Empty state — compact row
  if (windows.length === 0) {
    return (
      <>
        <div
          ref={containerRef}
          className={cn(
            'flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card px-3 py-2 shadow-soft transition-all',
            highlight && 'ring-2 ring-primary/50 border-primary/40'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              No open windows — drop an invite.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => setInviteOpen(true)}>
            <Send className="h-3 w-3 mr-1" />
            Invite
          </Button>
        </div>
        <OpenInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
      </>
    );
  }

  // Sort: most overlap first, then soonest
  const sorted = [...windows].sort((a, b) => {
    if (b.overlappingFriends.length !== a.overlappingFriends.length) {
      return b.overlappingFriends.length - a.overlappingFriends.length;
    }
    return a.date.getTime() - b.date.getTime();
  });

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          'space-y-2 rounded-xl transition-all',
          highlight && 'ring-2 ring-primary/50 p-2 -m-2 bg-primary/5'
        )}
      >
        <div className="flex items-center px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Recommended
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x snap-mandatory scrollbar-none">
          {sorted.map((w) => (
            <WindowChip
              key={w.date.toISOString() + w.slots[0]}
              window={w}
              onClick={() => setPlanFor(w)}
            />
          ))}
        </div>
      </div>
      <OpenInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
      {planFor && (
        <QuickPlanSheet
          open={!!planFor}
          onOpenChange={(v) => !v && setPlanFor(null)}
          preSelectedDate={planFor.date}
          preSelectedTimeSlot={planFor.slots[0] as TimeSlot}
          preSelectedFriends={planFor.overlappingFriends.map((f) => ({
            userId: f.userId,
            name: f.name,
            avatar: f.avatar,
          }))}
        />
      )}
    </>
  );
}

function WindowChip({ window: w, onClick }: { window: OpenWindow; onClick: () => void }) {
  const friendCount = w.overlappingFriends.length;
  return (
    <button
      onClick={onClick}
      className="snap-start shrink-0 min-w-[220px] max-w-[260px] rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-soft hover:border-primary/40 hover:shadow-md transition-all"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {w.dayLabel}
      </p>
      <p className="font-display text-lg font-semibold leading-tight mt-1 truncate">
        {w.startLabel}–{w.endLabel}
      </p>
      <div className="mt-2.5 flex items-center gap-2 min-h-[24px]">
        {friendCount > 0 ? (
          <>
            <div className="flex -space-x-1.5">
              {w.overlappingFriends.slice(0, 3).map((f) => (
                <Avatar key={f.userId} className="h-6 w-6 ring-1 ring-card">
                  {f.avatar && <AvatarImage src={f.avatar} alt={f.name} />}
                  <AvatarFallback className="text-[10px]">
                    {f.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {friendCount} free
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{w.hours}hr free</span>
        )}
      </div>
    </button>
  );
}
