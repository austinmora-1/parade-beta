import { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { useOpenWindows, type OpenWindow } from '@/hooks/useOpenWindows';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';

export function FreeWindowCard() {
  const { windows, loading } = useOpenWindows();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (loading) return null;

  // Empty state — compact row
  if (windows.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card px-3 py-2 shadow-soft">
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
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Open windows
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Send invite →
          </button>
        </div>

        <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x snap-mandatory scrollbar-none">
          {sorted.map((w) => (
            <WindowChip
              key={w.date.toISOString() + w.slots[0]}
              window={w}
              onClick={() => setInviteOpen(true)}
            />
          ))}
        </div>
      </div>
      <OpenInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

function WindowChip({ window: w, onClick }: { window: OpenWindow; onClick: () => void }) {
  const friendCount = w.overlappingFriends.length;
  return (
    <button
      onClick={onClick}
      className="snap-start shrink-0 min-w-[180px] max-w-[210px] rounded-xl border border-border bg-card px-3.5 py-2.5 text-left shadow-soft hover:border-primary/40 hover:shadow-md transition-all"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {w.dayLabel}
      </p>
      <p className="font-display text-base font-semibold leading-tight mt-0.5 truncate">
        {w.startLabel}–{w.endLabel}
      </p>
      <div className="mt-2 flex items-center gap-1.5 min-h-[20px]">
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
            <span className="text-[11px] text-muted-foreground truncate">
              {friendCount} free
            </span>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">{w.hours}hr free</span>
        )}
      </div>
    </button>
  );
}
