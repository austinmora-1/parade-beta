import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isToday } from 'date-fns';
import { CalendarPlus, ArrowRight } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CtaState =
  | { kind: 'open-today'; planId: string; title: string }
  | { kind: 'make-plan'; subtitle: string };

/**
 * State-aware primary CTA for the dashboard.
 *
 * Priority:
 *  1. Confirmed plan today → "Open today's plan"
 *  2. Fallback → "Make a plan"
 *
 * Note: Open-window suggestions are handled by the dedicated
 * Open Windows section to avoid duplication.
 */
export function SmartPrimaryCTA() {
  const navigate = useNavigate();
  const { plans } = usePlannerStore();
  const [makePlanOpen, setMakePlanOpen] = useState(false);

  const state = useMemo<CtaState>(() => {
    const now = new Date();
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
    return { kind: 'make-plan', subtitle: 'Get something on the books' };
  }, [plans]);

  const handleClick = () => {
    if (state.kind === 'open-today') {
      navigate(`/plan/${state.planId}`);
    } else {
      navigate('/friends?scheduler=1');
    }
  };

  const config = state.kind === 'open-today'
    ? {
        icon: ArrowRight,
        label: "Open today's plan",
        accent: 'text-primary',
        ring: 'ring-primary/30',
        gradient: 'from-primary/10 via-card to-card',
        iconBg: 'bg-primary/15 text-primary',
        eyebrow: 'Happening today',
        eyebrowText: state.title,
      }
    : {
        icon: CalendarPlus,
        label: 'Find time with friends',
        accent: 'text-foreground',
        ring: 'ring-border',
        gradient: 'from-muted/40 via-card to-card',
        iconBg: 'bg-muted text-foreground',
        eyebrow: 'Quick start',
        eyebrowText: state.subtitle,
      };

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

// Silence unused-import warning for future use
void Button;
