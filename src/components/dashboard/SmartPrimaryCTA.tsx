import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isToday, isSameDay } from 'date-fns';
import { Sparkles, Send, CalendarPlus, ArrowRight, Users } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useOpenWindows } from '@/hooks/useOpenWindows';
import { useOpenInvites } from '@/hooks/useOpenInvites';
import { Button } from '@/components/ui/button';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';
import { GuidedPlanSheet } from '@/components/plans/GuidedPlanSheet';
import { cn } from '@/lib/utils';

type CtaState =
  | { kind: 'open-today'; planId: string; title: string }
  | { kind: 'send-open-invite'; subtitle: string }
  | { kind: 'drop-open-invite'; subtitle: string }
  | { kind: 'make-plan'; subtitle: string };

/**
 * State-aware primary CTA for the dashboard.
 *
 * Picks one of four actions, in priority order:
 *  1. There's a confirmed plan today → "Open today's plan"
 *  2. Open windows w/ friend overlap → "Send open invite"
 *  3. Open windows but no overlap, OR no upcoming plans this week →
 *     "Drop an open invite"
 *  4. Fallback → "Make a plan"
 */
export function SmartPrimaryCTA() {
  const navigate = useNavigate();
  const { plans } = usePlannerStore();
  const { windows } = useOpenWindows();
  const { mine: myOpenInvites } = useOpenInvites();
  const [openInviteOpen, setOpenInviteOpen] = useState(false);
  const [makePlanOpen, setMakePlanOpen] = useState(false);

  const state = useMemo<CtaState>(() => {
    const now = new Date();

    // 1. Confirmed plan today (any status not cancelled)
    const todayPlan = plans.find(
      (p) => isToday(p.date) && p.status !== 'cancelled' && p.date >= now
    );
    if (todayPlan) {
      return {
        kind: 'open-today',
        planId: todayPlan.id,
        title: todayPlan.title || todayPlan.activity || 'Today',
      };
    }

    // 2. Best open window with friend overlap
    const bestOverlap = [...windows]
      .filter((w) => w.overlappingFriends.length > 0)
      .sort((a, b) => {
        if (b.overlappingFriends.length !== a.overlappingFriends.length) {
          return b.overlappingFriends.length - a.overlappingFriends.length;
        }
        return a.date.getTime() - b.date.getTime();
      })[0];
    if (bestOverlap) {
      const fc = bestOverlap.overlappingFriends.length;
      return {
        kind: 'send-open-invite',
        subtitle: `${bestOverlap.dayLabel} ${bestOverlap.startLabel}–${bestOverlap.endLabel} · ${fc} free`,
      };
    }

    // 3. Open windows w/o overlap OR no plans in the next 7 days
    const sevenDaysOut = new Date();
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const upcomingThisWeek = plans.filter(
      (p) => p.date >= now && p.date <= sevenDaysOut && p.status !== 'cancelled'
    );
    const hasActiveOpenInvite = myOpenInvites.some(
      (i) => i.status === 'open' && new Date(i.expiresAt) > now
    );

    if (windows.length > 0 && !hasActiveOpenInvite) {
      const w = windows[0];
      return {
        kind: 'drop-open-invite',
        subtitle: `${w.dayLabel} ${w.startLabel}–${w.endLabel} is open`,
      };
    }
    if (upcomingThisWeek.length === 0 && !hasActiveOpenInvite) {
      return {
        kind: 'drop-open-invite',
        subtitle: 'No plans yet this week',
      };
    }

    // 4. Fallback
    return {
      kind: 'make-plan',
      subtitle: hasActiveOpenInvite
        ? "Invite's out — start something new?"
        : 'Get something on the books',
    };
  }, [plans, windows, myOpenInvites]);

  const handleClick = () => {
    switch (state.kind) {
      case 'open-today':
        navigate(`/plan/${state.planId}`);
        return;
      case 'send-open-invite':
      case 'drop-open-invite':
        setOpenInviteOpen(true);
        return;
      case 'make-plan':
        setMakePlanOpen(true);
        return;
    }
  };

  const config = (() => {
    switch (state.kind) {
      case 'open-today':
        return {
          icon: ArrowRight,
          label: "Open today's plan",
          accent: 'text-primary',
          ring: 'ring-primary/30',
          gradient: 'from-primary/10 via-card to-card',
          iconBg: 'bg-primary/15 text-primary',
          eyebrow: 'Happening today',
          eyebrowText: state.title,
        };
      case 'send-open-invite':
        return {
          icon: Send,
          label: 'Send open invite',
          accent: 'text-primary',
          ring: 'ring-primary/30',
          gradient: 'from-primary/10 via-card to-card',
          iconBg: 'bg-primary/15 text-primary',
          eyebrow: 'Friends are around',
          eyebrowText: state.subtitle,
        };
      case 'drop-open-invite':
        return {
          icon: Sparkles,
          label: 'Drop an open invite',
          accent: 'text-secondary-foreground',
          ring: 'ring-secondary/30',
          gradient: 'from-secondary/10 via-card to-card',
          iconBg: 'bg-secondary/20 text-secondary-foreground',
          eyebrow: 'Open window',
          eyebrowText: state.subtitle,
        };
      case 'make-plan':
        return {
          icon: CalendarPlus,
          label: 'Make a plan',
          accent: 'text-foreground',
          ring: 'ring-border',
          gradient: 'from-muted/40 via-card to-card',
          iconBg: 'bg-muted text-foreground',
          eyebrow: 'Quick start',
          eyebrowText: state.subtitle,
        };
    }
  })();

  const Icon = config.icon;

  return (
    <>
      <motion.button
        layout
        onClick={handleClick}
        whileTap={{ scale: 0.985 }}
        className={cn(
          'group w-full text-left rounded-2xl border bg-gradient-to-br shadow-soft px-3.5 py-3 ring-1 transition-all hover:shadow-md',
          config.gradient,
          config.ring,
          'border-border/60'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('shrink-0 rounded-xl p-2.5', config.iconBg)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[10px] font-semibold uppercase tracking-wider', config.accent)}>
              {config.eyebrow}
            </p>
            <p className="font-display text-base font-semibold leading-tight truncate">
              {config.label}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {config.eyebrowText}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
        </div>
      </motion.button>

      <OpenInviteSheet open={openInviteOpen} onOpenChange={setOpenInviteOpen} />
      {makePlanOpen && (
        <GuidedPlanSheet
          open={makePlanOpen}
          onOpenChange={setMakePlanOpen}
          preSelectedFriends={[]}
        />
      )}
    </>
  );
}

// Silence unused-import warnings for tree-shake-friendly future use
void Users;
void isSameDay;
