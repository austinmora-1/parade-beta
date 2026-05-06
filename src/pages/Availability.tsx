import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, isSameDay, differenceInWeeks } from 'date-fns';
import { ShareDialog } from '@/components/dashboard/ShareDialog';

const GuidedPlanSheet = lazy(() => import('@/components/plans/GuidedPlanSheet'));
const GuidedTripSheet = lazy(() => import('@/components/trips/GuidedTripSheet'));
import { Button } from '@/components/ui/button';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  RefreshCw, Loader2, Plus, Plane, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useAppleCalendar } from '@/hooks/useAppleCalendar';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDisplayPlans } from '@/hooks/useDisplayPlans';
import { useUserTrips } from '@/hooks/useUserTrips';
import { useSlotCoverageByDate } from '@/hooks/useSlotCoverage';
import { TripsList } from '@/components/trips/TripsList';
import { WeekendHeroCard } from '@/components/plans/weekly-plan/WeekendHeroCard';
import { WeekdayRow } from '@/components/plans/weekly-plan/WeekdayRow';
import { NextTripCTA } from '@/components/trips/NextTripCTA';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { List } from 'lucide-react';


type ViewFilter = 'all' | 'plans' | 'trips';
const VALID_VIEWS: ViewFilter[] = ['all', 'plans', 'trips'];

export default function Availability() {
  
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected: isGcalConnected, isSyncing: isGcalSyncing, syncCalendar: syncGcal } = useGoogleCalendar();
  const { isConnected: isIcalConnected, isSyncing: isIcalSyncing, syncCalendar: syncIcal } = useAppleCalendar();
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);
  const loadPlans = usePlannerStore((s) => s.loadPlans);
  const rawPlans = usePlannerStore((s) => s.plans);
  const { displayPlans: plans } = useDisplayPlans(rawPlans);
  const availabilityMap = usePlannerStore((s) => s.availabilityMap);
  const coverageByDate = useSlotCoverageByDate();
  const { trips } = useUserTrips();

  const [guidedPlanOpen, setGuidedPlanOpen] = useState(false);
  const [guidedTripOpen, setGuidedTripOpen] = useState(false);
  const [tripsListOpen, setTripsListOpen] = useState(false);

  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // URL-synced view filter (?view=all|plans|trips)
  const viewParam = searchParams.get('view');
  const viewFilter: ViewFilter = (VALID_VIEWS as string[]).includes(viewParam || '')
    ? (viewParam as ViewFilter)
    : 'all';

  const setViewFilter = useCallback((v: ViewFilter) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('view');
    else next.set('view', v);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Week math
  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    return sameMonth
      ? `${format(weekStart, 'MMM d')} – ${format(end, 'd')}`
      : `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d')}`;
  }, [weekStart]);

  const today = new Date();

  const filteredPlans = useMemo(() => {
    if (viewFilter === 'trips') return [];
    return plans;
  }, [plans, viewFilter]);

  const showWeekend = viewFilter !== 'trips';
  const showWeekdays = viewFilter !== 'trips';
  

  const weekdayDays = useMemo(() => weekDays.slice(0, 5), [weekDays]); // Mon–Fri

  const plansForDay = useCallback((d: Date) => {
    const key = format(d, 'yyyy-MM-dd');
    return filteredPlans.filter((p) => format(p.date, 'yyyy-MM-dd') === key);
  }, [filteredPlans]);

  const openNewPlan = (_date?: Date) => {
    setGuidedPlanOpen(true);
  };
  const openNewTrip = () => setGuidedTripOpen(true);

  const isConnected = isGcalConnected || isIcalConnected;
  const isSyncing = isGcalSyncing || isIcalSyncing;

  const handleSync = async () => {
    const results: string[] = [];
    let anySynced = false;
    if (isGcalConnected) {
      const result = await syncGcal();
      if (result.synced) { anySynced = true; results.push('Google Calendar'); }
    }
    if (isIcalConnected) {
      const result = await syncIcal();
      if (result.synced) { anySynced = true; results.push('Apple Calendar'); }
    }
    if (anySynced) {
      toast.success(`Synced ${results.join(' & ')} successfully`);
      await Promise.all([loadProfileAndAvailability(), loadPlans()]);
    } else {
      toast.error('Failed to sync calendar');
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const selectedWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    setWeekOffset(differenceInWeeks(selectedWeekStart, todayWeekStart));
    setCalendarOpen(false);
  };

  // Round circular icon button helper
  const CircleBtn = ({
    onClick, children, label, active = false,
  }: { onClick: () => void; children: React.ReactNode; label: string; active?: boolean }) => (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-muted',
        active && 'border-primary bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h1 className="font-display font-black leading-tight tracking-tight md:text-4xl text-2xl">
          Plans &amp; Trips
        </h1>
        {isConnected && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            aria-label="Sync calendar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft hover:bg-muted disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Action row + filter pills */}
      <div className="flex items-center gap-2">
        <CircleBtn onClick={() => openNewPlan()} label="Add plan">
          <Plus className="h-4 w-4" />
        </CircleBtn>
        <CircleBtn onClick={openNewTrip} label="Add trip">
          <Plane className="h-4 w-4" />
        </CircleBtn>
        <ShareDialog
          trigger={
            <button
              aria-label="Share availability"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft hover:bg-muted"
            >
              <CalendarShareIcon className="h-4 w-4" />
            </button>
          }
        />

        <div className="ml-auto flex items-center gap-1 rounded-full bg-muted/40 p-0.5">
          {(['all', 'plans', 'trips'] as ViewFilter[]).map((v) => {
            const active = viewFilter === v;
            return (
              <button
                key={v}
                onClick={() => setViewFilter(v)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-bold transition-colors',
                  active
                    ? 'bg-secondary/15 text-secondary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'all' ? 'All' : v === 'plans' ? 'Plans' : 'Trips'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => o - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-base font-bold">{weekLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={handleDateSelect}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((o) => o + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {weekOffset !== 0 && (
        <div className="flex justify-center -mt-2">
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs font-bold text-primary hover:text-primary/80"
          >
            Back to this week
          </button>
        </div>
      )}

      {/* Weekend hero */}
      {showWeekend && (
        <WeekendHeroCard
          weekStart={weekStart}
          plans={filteredPlans}
          trips={trips}
          availabilityMap={availabilityMap}
          coverageByDate={coverageByDate}
          onAddPlan={openNewPlan}
        />
      )}

      {/* Weekdays */}
      {showWeekdays && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <span className="text-secondary">Weekdays</span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">Mon – Fri</span>
          </div>
          <div className="space-y-2">
            {weekdayDays.map((d) => (
              <WeekdayRow
                key={d.toISOString()}
                date={d}
                plans={plansForDay(d)}
                isToday={isSameDay(d, today)}
                availabilityMap={availabilityMap}
                coverageByDate={coverageByDate}
                onAddPlan={openNewPlan}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trips view: next trip CTA + entry to full list */}
      {viewFilter === 'trips' && (
        <div className="pt-2 space-y-3">
          <NextTripCTA
            onJumpToWeek={(offset) => {
              setWeekOffset(offset);
              setViewFilter('all');
            }}
          />
          <Button
            variant="outline"
            className="w-full justify-between h-12"
            onClick={() => setTripsListOpen(true)}
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4" />
              View all trips
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Sheet open={tripsListOpen} onOpenChange={setTripsListOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="font-display text-2xl">Your trips</SheetTitle>
          </SheetHeader>
          <TripsList />
        </SheetContent>
      </Sheet>

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
          <GuidedTripSheet
            open={guidedTripOpen}
            onOpenChange={(open) => {
              setGuidedTripOpen(open);
              if (!open) loadProfileAndAvailability();
            }}
          />
        </Suspense>
      )}

    </div>
  );
}
