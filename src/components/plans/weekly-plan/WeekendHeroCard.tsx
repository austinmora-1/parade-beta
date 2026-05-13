import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { Plane, Plus, Sparkles } from 'lucide-react';
import { Plan, DayAvailability, TimeSlot } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import type { UserTrip } from '@/hooks/useUserTrips';
import { cn } from '@/lib/utils';
import { getDayStatus } from './dayStatus';
import { ACTIVITY_CONFIG } from '@/types/planner';

interface Props {
  weekStart: Date; // Monday
  plans: Plan[];
  trips: UserTrip[];
  availabilityMap: Record<string, DayAvailability>;
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>;
  onAddPlan: (date: Date) => void;
}

/**
 * Big featured card pinned at the top of the Plans & Trips page.
 * Highlights the upcoming weekend (Sat + Sun of the visible week) and any
 * trip overlapping that weekend.
 */
export function WeekendHeroCard({
  weekStart,
  plans,
  trips,
  availabilityMap,
  coverageByDate,
  onAddPlan,
}: Props) {
  const navigate = useNavigate();
  const sat = useMemo(() => addDays(weekStart, 5), [weekStart]);
  const sun = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const weekendTrip = useMemo(() => {
    return trips.find((t) => {
      const ts = new Date(t.start_date + 'T00:00:00');
      const te = new Date(t.end_date + 'T00:00:00');
      return !isAfter(ts, sun) && !isBefore(te, sat);
    });
  }, [trips, sat, sun]);

  const weekendPlans = useMemo(() => {
    const satKey = format(sat, 'yyyy-MM-dd');
    const sunKey = format(sun, 'yyyy-MM-dd');
    const sortBySlot = (a: Plan, b: Plan) => {
      const order: Record<string, number> = {
        'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
        'late-afternoon': 3, 'evening': 4, 'late-night': 5,
      };
      return (order[a.timeSlot] ?? 0) - (order[b.timeSlot] ?? 0);
    };
    const satP = plans.filter((p) => format(p.date, 'yyyy-MM-dd') === satKey).sort(sortBySlot);
    const sunP = plans.filter((p) => format(p.date, 'yyyy-MM-dd') === sunKey).sort(sortBySlot);
    return { sat: satP, sun: sunP };
  }, [plans, sat, sun]);

  const dateLabel = useMemo(() => {
    const sameMonth = sat.getMonth() === sun.getMonth();
    return sameMonth
      ? `${format(sat, 'EEE d')} – ${format(sun, 'EEE d')}`
      : `${format(sat, 'MMM d')} – ${format(sun, 'MMM d')}`;
  }, [sat, sun]);

  const headline = weekendTrip
    ? (weekendTrip.name?.trim() || (weekendTrip.location ? `Headed to ${weekendTrip.location}` : 'Weekend trip'))
    : weekendPlans.sat.length + weekendPlans.sun.length > 0
      ? 'Weekend lineup'
      : 'Open weekend';

  const subhead = weekendTrip
    ? null
    : weekendPlans.sat.length + weekendPlans.sun.length > 0
      ? null
      : 'Two clear days to fill — make plans or pencil in some rest.';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-soft',
        weekendTrip
          ? 'border-primary/30 bg-gradient-to-br from-primary/15 via-card to-[hsl(var(--sunshine)/0.18)] dark:border-primary/40 dark:from-primary/25 dark:via-card dark:to-[hsl(var(--sunshine)/0.22)]'
          : 'border-border bg-card dark:bg-gradient-to-br dark:from-card dark:via-card dark:to-primary/5',
      )}
    >
      {weekendTrip && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[hsl(var(--sunshine)/0.3)] dark:bg-[hsl(var(--sunshine)/0.35)] blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-primary/25 dark:bg-primary/30 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute right-3 top-2 text-base bg-gradient-to-r from-primary to-[hsl(var(--sunshine))] bg-clip-text text-transparent">✦</span>
          <span aria-hidden className="pointer-events-none absolute right-8 top-6 text-[10px] bg-gradient-to-r from-primary to-[hsl(var(--sunshine))] bg-clip-text text-transparent">✺</span>
        </>
      )}

      <div className="relative flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span className={cn('h-1.5 w-1.5 rounded-full bg-gradient-to-r from-primary to-[hsl(var(--sunshine))]', weekendTrip && 'animate-pulse')} />
        <span className="bg-gradient-to-r from-primary to-[hsl(var(--sunshine))] bg-clip-text text-transparent dark:from-[hsl(150_55%_72%)] dark:to-[hsl(var(--sunshine))]">This Weekend</span>
        <span className="font-medium normal-case tracking-normal text-stone-400">{dateLabel}</span>
      </div>

      <h2 className="relative mt-2 font-display text-2xl font-black leading-tight tracking-tight">
        {weekendTrip && <Plane className="mr-1 inline-block h-5 w-5 align-[-2px] text-primary" />}
        {weekendTrip ? (
          <span className="bg-gradient-to-r from-primary to-[hsl(var(--sunshine))] bg-clip-text text-transparent dark:from-[hsl(150_55%_72%)] dark:to-[hsl(var(--sunshine))]">{headline}</span>
        ) : (
          headline
        )}{weekendTrip ? '.' : ''}
      </h2>
      {subhead && <p className="mt-1 text-sm text-muted-foreground">{subhead}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <DayMini
          date={sat}
          plans={weekendPlans.sat}
          availabilityMap={availabilityMap}
          coverageByDate={coverageByDate}
          onAddPlan={onAddPlan}
          onPlanTap={(p) => navigate(`/plan/${p.id}`)}
          weekendTrip={weekendTrip}
        />
        <DayMini
          date={sun}
          plans={weekendPlans.sun}
          availabilityMap={availabilityMap}
          coverageByDate={coverageByDate}
          onAddPlan={onAddPlan}
          onPlanTap={(p) => navigate(`/plan/${p.id}`)}
          weekendTrip={weekendTrip}
        />
      </div>

      {weekendTrip && (
        <button
          onClick={() => navigate(`/trip/${weekendTrip.id}`)}
          className="group relative mt-3 flex w-full items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary/15 to-[hsl(var(--sunshine)/0.2)] hover:from-primary/25 hover:to-[hsl(var(--sunshine)/0.3)] dark:from-primary/25 dark:to-[hsl(var(--sunshine)/0.25)] dark:hover:from-primary/35 dark:hover:to-[hsl(var(--sunshine)/0.35)] px-3 py-2 text-left text-xs font-medium text-foreground transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary dark:text-[hsl(var(--sunshine))]" />
          <span className="truncate">
            {weekendTrip.location ? `Trip to ${weekendTrip.location}` : 'View trip details'}
          </span>
        </button>
      )}
    </section>
  );
}

function DayMini({
  date,
  plans,
  availabilityMap,
  coverageByDate,
  onAddPlan,
  onPlanTap,
  weekendTrip,
}: {
  date: Date;
  plans: Plan[];
  availabilityMap: Record<string, DayAvailability>;
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>;
  onAddPlan: (date: Date) => void;
  onPlanTap: (plan: Plan) => void;
  weekendTrip?: UserTrip;
}) {
  const navigate = useNavigate();
  const dayName = format(date, 'EEE');
  const dayNum = format(date, 'd');

  const status = getDayStatus(date, coverageByDate, availabilityMap);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/day/${format(date, 'yyyy-MM-dd')}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/day/${format(date, 'yyyy-MM-dd')}`);
      }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-background/40 dark:bg-background/50 dark:border-border/40 p-2.5 text-left cursor-pointer transition-colors hover:bg-background/70 dark:hover:bg-background/70"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', status.accentClass)} aria-hidden />
      <div className="pl-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-black leading-none">{dayNum}</span>
          <span className="text-sm font-semibold text-muted-foreground">{dayName}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClass)} />
          {status.label}
        </div>
        <div className="mt-2 space-y-1">
          {plans.length === 0 && !weekendTrip && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddPlan(date); }}
              className="flex w-full items-center gap-1 text-left text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add plan
            </button>
          )}
          {plans.length === 0 && weekendTrip && (
            <p className="text-[11px] font-medium text-muted-foreground">No plans yet</p>
          )}
          {plans.slice(0, 2).map((p) => {
            const cfg = ACTIVITY_CONFIG[p.activity as keyof typeof ACTIVITY_CONFIG];
            const icon = cfg?.icon || '📅';
            return (
              <button
                key={p.id}
                onClick={(e) => { e.stopPropagation(); onPlanTap(p); }}
                className="flex w-full items-center gap-1.5 rounded-md text-left text-[12px] font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="shrink-0 text-xs leading-none">{icon}</span>
                <span className="truncate">{p.title || cfg?.label || 'Plan'}</span>
              </button>
            );
          })}
          {plans.length > 2 && (
            <p className="text-[10px] font-medium text-muted-foreground">+{plans.length - 2} more</p>
          )}
        </div>
      </div>
    </div>
  );
}
