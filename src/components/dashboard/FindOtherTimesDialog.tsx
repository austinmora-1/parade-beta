import { useState } from 'react';
import { Sparkles, Send, UserPlus, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOpenWindows, type OpenWindow } from '@/hooks/useOpenWindows';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';
import { FindPeopleSheet } from '@/components/plans/FindPeopleSheet';
import type { TimeSlot } from '@/types/planner';

interface FindOtherTimesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FindOtherTimesDialog({ open, onOpenChange }: FindOtherTimesDialogProps) {
  const { windows, loading } = useOpenWindows();
  const [broadcastFor, setBroadcastFor] = useState<OpenWindow | null>(null);
  const [suggestFor, setSuggestFor] = useState<OpenWindow | null>(null);

  // Sort: soonest first
  const sorted = [...windows].sort((a, b) => a.date.getTime() - b.date.getTime());

  const handleBroadcast = (w: OpenWindow) => {
    onOpenChange(false);
    setTimeout(() => setBroadcastFor(w), 200);
  };

  const handleSuggest = (w: OpenWindow) => {
    onOpenChange(false);
    setTimeout(() => setSuggestFor(w), 200);
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
              Pick an open window to broadcast or invite specific friends.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
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
                onBroadcast={() => handleBroadcast(w)}
                onSuggest={() => handleSuggest(w)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {broadcastFor && (
        <OpenInviteSheet
          open={!!broadcastFor}
          onOpenChange={(v) => !v && setBroadcastFor(null)}
          initialDate={broadcastFor.date}
          initialSlot={broadcastFor.slots[0] as TimeSlot}
        />
      )}

      {suggestFor && (
        <FindPeopleSheet
          open={!!suggestFor}
          onOpenChange={(v) => !v && setSuggestFor(null)}
          initialDate={suggestFor.date}
          initialSlot={suggestFor.slots[0] as TimeSlot}
        />
      )}
    </>
  );
}

function WindowRow({
  window: w,
  onBroadcast,
  onSuggest,
}: {
  window: OpenWindow;
  onBroadcast: () => void;
  onSuggest: () => void;
}) {
  const friendCount = w.overlappingFriends.length;
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {w.dayLabel}
          </p>
          <p className="font-display text-base font-semibold leading-tight mt-0.5">
            {w.startLabel}–{w.endLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5 min-h-[20px] shrink-0">
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
              <span className="text-[11px] text-muted-foreground">{friendCount} free</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">{w.hours}hr free</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={onBroadcast}
        >
          <Send className="h-3 w-3 mr-1" />
          Broadcast
        </Button>
        <Button
          size="sm"
          variant="default"
          className="h-8 text-xs"
          onClick={onSuggest}
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Suggest friends
        </Button>
      </div>
    </div>
  );
}
