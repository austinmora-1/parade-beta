import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { Plane, Plus, Sparkles } from 'lucide-react';
import { Plan, DayAvailability, TimeSlot } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import type { UserTrip } from '@/hooks/useUserTrips';
import { cn } from '@/lib/utils';
import { SlotCoverageBar } from './SlotCoverageBar';
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
        'relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft',
        weekendTrip && 'bg-gradient-to-br from-primary/5 via-card to-card border-primary/20',
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
        <span className="text-secondary">This Weekend</span>
        <span className="font-medium normal-case tracking-normal text-muted-foreground">{dateLabel}</span>
      </div>

      <h2 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight">
        {weekendTrip && <Plane className="mr-1 inline-block h-5 w-5 align-[-2px] text-primary" />}
        {headline}{weekendTrip ? '.' : ''}
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
          className="mt-3 flex w-full items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/70 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
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
  const dayName = format(date, 'EEE');
  const dayNum = format(date, 'd');

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-black leading-none">{dayNum}</span>
        <span className="text-sm font-semibold text-muted-foreground">{dayName}</span>
      </div>
      <div className="mt-2">
        <SlotCoverageBar
          date={date}
          coverageByDate={coverageByDate}
          availabilityMap={availabilityMap}
        />
      </div>
      <div className="mt-2 space-y-1">
        {plans.length === 0 && !weekendTrip && (
          <button
            onClick={() => onAddPlan(date)}
            className="flex w-full items-center gap-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
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
              onClick={() => onPlanTap(p)}
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
  );
}
