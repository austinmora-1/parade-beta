import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Sparkles, Send, Share2 } from 'lucide-react';
import { useOpenWindows, type OpenWindow } from '@/hooks/useOpenWindows';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePlannerStore } from '@/stores/plannerStore';
import type { TimeSlot } from '@/types/planner';
import { cn } from '@/lib/utils';

const PRIMARY_DOMAIN = 'https://helloparade.app';

export function FreeWindowCard() {
  const { user } = useAuth();
  const { windows, loading } = useOpenWindows();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareFor, setShareFor] = useState<OpenWindow | null>(null);
  const [planFor, setPlanFor] = useState<OpenWindow | null>(null);
  const [highlight, setHighlight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

  const generateShareLink = async () => {
    if (!shareFor || !user?.id) throw new Error('Not ready');
    const dateStr = format(shareFor.date, 'yyyy-MM-dd');
    const noonUtcDate = `${dateStr}T12:00:00+00:00`;
    const slot = shareFor.slots[0] as TimeSlot;
    const title = `Open hang — ${shareFor.dayLabel}, ${shareFor.startLabel}`;

    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .insert({
        user_id: user.id,
        title,
        activity: 'meetup',
        date: noonUtcDate,
        time_slot: slot,
        duration: 60,
        status: 'confirmed',
        feed_visibility: 'private',
        source_timezone: usePlannerStore.getState().userTimezone,
      } as any)
      .select('id')
      .single();
    if (planErr || !plan?.id) throw planErr || new Error('Failed to create plan');

    const { data: invite, error: invErr } = await supabase
      .from('plan_invites')
      .insert({ plan_id: plan.id, invited_by: user.id })
      .select('invite_token')
      .single();
    if (invErr || !invite?.invite_token) throw invErr || new Error('Failed to create invite');

    usePlannerStore.getState().loadPlans?.();

    return `${PRIMARY_DOMAIN}/invite.html?t=${invite.invite_token}`;
  };

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
              onShare={() => setShareFor(w)}
            />
          ))}
        </div>
      </div>
      <OpenInviteSheet
        open={inviteOpen || !!shareFor}
        onOpenChange={(v) => {
          if (!v) {
            setInviteOpen(false);
            setShareFor(null);
          }
        }}
        initialDate={shareFor?.date}
        initialSlot={shareFor?.slots[0] as TimeSlot | undefined}
      />
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

function WindowChip({
  window: w,
  onClick,
  onShare,
}: {
  window: OpenWindow;
  onClick: () => void;
  onShare: () => void;
}) {
  const friendCount = w.overlappingFriends.length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="relative snap-start shrink-0 min-w-[220px] max-w-[260px] rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-soft hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
    >
      <button
        type="button"
        aria-label="Quick share this time"
        onClick={(e) => {
          e.stopPropagation();
          onShare();
        }}
        className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <Share2 className="h-3.5 w-3.5" />
      </button>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground pr-8">
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
    </div>
  );
}
