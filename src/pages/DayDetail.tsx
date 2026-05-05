import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parse, isValid, isSameDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Plane, CalendarDays } from 'lucide-react';
import { useState, useCallback, lazy, Suspense } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useDisplayPlans } from '@/hooks/useDisplayPlans';
import { useUserTrips } from '@/hooks/useUserTrips';
import { useSlotCoverageByDate } from '@/hooks/useSlotCoverage';
import { Plan, TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';
import { SlotCoverageBar } from '@/components/plans/weekly-plan/SlotCoverageBar';
import { PlanCardCompact } from '@/components/plans/weekly-plan/PlanCardCompact';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));

const SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

export default function DayDetail() {
  const { date: dateParam } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const date = useMemo(() => {
    if (!dateParam) return new Date();
    const parsed = parse(dateParam, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? parsed : new Date();
  }, [dateParam]);

  const rawPlans = usePlannerStore((s) => s.plans);
  const { displayPlans } = useDisplayPlans(rawPlans);
  const availabilityMap = usePlannerStore((s) => s.availabilityMap);
  const coverageByDate = useSlotCoverageByDate();
  const { trips } = useUserTrips();

  const [guidedPlanOpen, setGuidedPlanOpen] = useState(false);
  const [guidedTripOpen, setGuidedTripOpen] = useState(false);

  const dayPlans = useMemo(() => {
    const key = format(date, 'yyyy-MM-dd');
    return displayPlans.filter((p) => format(p.date, 'yyyy-MM-dd') === key);
  }, [displayPlans, date]);

  const plansBySlot = useMemo(() => {
    const map = new Map<TimeSlot, Plan[]>();
    SLOT_ORDER.forEach((s) => map.set(s, []));
    dayPlans.forEach((p) => {
      const list = map.get(p.timeSlot) ?? [];
      list.push(p);
      map.set(p.timeSlot, list);
    });
    return map;
  }, [dayPlans]);

  const dayTrip = useMemo(() => {
    const t = trips.find((trip) => {
      const ts = new Date(trip.start_date + 'T00:00:00');
      const te = new Date(trip.end_date + 'T00:00:00');
      return date >= ts && date <= te;
    });
    return t;
  }, [trips, date]);

  const goPrev = useCallback(() => {
    const prev = addDays(date, -1);
    navigate(`/day/${format(prev, 'yyyy-MM-dd')}`);
  }, [date, navigate]);

  const goNext = useCallback(() => {
    const next = addDays(date, 1);
    navigate(`/day/${format(next, 'yyyy-MM-dd')}`);
  }, [date, navigate]);

  const isToday = isSameDay(date, new Date());

  return (
    <div className="animate-fade-in space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="h-10 w-10 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            <span>{isToday ? 'Today' : format(date, 'EEEE')}</span>
            <span className="font-medium normal-case tracking-normal text-muted-foreground">
              {format(date, 'MMM d, yyyy')}
            </span>
          </div>
          <h1 className="font-display font-black leading-tight tracking-tight text-2xl md:text-4xl">
            {format(date, 'EEEE')}
          </h1>
        </div>
        <Button variant="ghost" size="icon" onClick={goPrev} aria-label="Previous day" className="h-9 w-9">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goNext} aria-label="Next day" className="h-9 w-9">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Coverage bar */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
        <SlotCoverageBar
          date={date}
          coverageByDate={coverageByDate}
          availabilityMap={availabilityMap}
        />
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>{dayPlans.length} {dayPlans.length === 1 ? 'plan' : 'plans'}</span>
          {dayTrip && (
            <button
              onClick={() => navigate(`/trip/${dayTrip.id}`)}
              className="flex items-center gap-1 font-bold text-primary hover:underline"
            >
              <Plane className="h-3 w-3" />
              {dayTrip.location ? `Trip to ${dayTrip.location}` : 'On a trip'}
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setGuidedPlanOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-soft hover:bg-muted"
        >
          <Plus className="h-4 w-4" /> Plan
        </button>
        <button
          onClick={() => setGuidedTripOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-bold text-foreground shadow-soft hover:bg-muted"
        >
          <Plane className="h-4 w-4" /> Trip
        </button>
      </div>

      {/* Slots */}
      <div className="space-y-3">
        {SLOT_ORDER.map((slot) => {
          const plans = plansBySlot.get(slot) ?? [];
          const cfg = TIME_SLOT_LABELS[slot];
          return (
            <section key={slot} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-foreground">{cfg.label}</h2>
                <span className="text-[11px] font-medium text-muted-foreground">{cfg.time}</span>
              </div>
              {plans.length === 0 ? (
                <button
                  onClick={() => setGuidedPlanOpen(true)}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card/40 px-3 py-3 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground transition-colors',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" /> Add plan
                </button>
              ) : (
                <div className="space-y-2">
                  {plans.map((p) => (
                    <PlanCardCompact
                      key={p.id}
                      plan={p}
                      onTap={() => navigate(`/plan/${p.id}`)}
                      selectMode={false}
                      selected={false}
                      onLongPress={() => {}}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {guidedPlanOpen && (
        <Suspense fallback={null}>
          <GuidedPlanSheet
            open={guidedPlanOpen}
            onOpenChange={setGuidedPlanOpen}
            preSelectedFriends={[]}
          />
        </Suspense>
      )}
      {guidedTripOpen && (
        <Suspense fallback={null}>
          <GuidedTripSheet open={guidedTripOpen} onOpenChange={setGuidedTripOpen} />
        </Suspense>
      )}
    </div>
  );
}
