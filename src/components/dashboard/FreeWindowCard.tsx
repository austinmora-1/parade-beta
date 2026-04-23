import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, ArrowRight, Send } from 'lucide-react';
import { useOpenWindows } from '@/hooks/useOpenWindows';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';
import { cn } from '@/lib/utils';
import { formatDisplayName } from '@/lib/formatName';

export function FreeWindowCard() {
  const { windows, loading } = useOpenWindows();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (loading) return null;

  // Empty state — no open windows in the next several days
  if (windows.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-border bg-card p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-muted p-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">No open windows yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drop an open invite and let friends claim it.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Invite
            </Button>
          </div>
        </div>
        <OpenInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
      </>
    );
  }

  // Pick the best window — most friend overlap, then soonest
  const best = [...windows].sort((a, b) => {
    if (b.overlappingFriends.length !== a.overlappingFriends.length) {
      return b.overlappingFriends.length - a.overlappingFriends.length;
    }
    return a.date.getTime() - b.date.getTime();
  })[0];

  const friendCount = best.overlappingFriends.length;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-soft"
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Open window
          </p>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-display text-lg font-semibold leading-tight">
            {best.dayLabel}, {best.startLabel}–{best.endLabel}
          </h3>
          <span className="text-xs text-muted-foreground">
            {best.hours} hr free
          </span>
        </div>

        {friendCount > 0 ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {best.overlappingFriends.slice(0, 4).map((f) => (
                <Avatar key={f.userId} className="h-7 w-7 ring-2 ring-card">
                  {f.avatar && <AvatarImage src={f.avatar} alt={f.name} />}
                  <AvatarFallback className="text-[10px]">
                    {f.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs text-muted-foreground min-w-0 flex-1 truncate">
              {friendCount === 1
                ? `${formatDisplayName(best.overlappingFriends[0].name)} is free too`
                : `${formatDisplayName(best.overlappingFriends[0].name)} + ${friendCount - 1} other${friendCount - 1 === 1 ? '' : 's'} free`}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No overlap yet — drop an open invite and see who bites.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => setInviteOpen(true)}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Send open invite
          </Button>
        </div>

        {/* Other windows as a compact strip */}
        {windows.length > 1 && (
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
              Also free
            </span>
            {windows
              .filter((w) => w !== best)
              .slice(0, 3)
              .map((w) => (
                <span
                  key={w.date.toISOString()}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium shrink-0'
                  )}
                >
                  {w.dayLabel} · {w.hours}hr
                  {w.overlappingFriends.length > 0 && (
                    <span className="text-muted-foreground">
                      · {w.overlappingFriends.length}
                    </span>
                  )}
                </span>
              ))}
          </div>
        )}
      </motion.div>
      <OpenInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
