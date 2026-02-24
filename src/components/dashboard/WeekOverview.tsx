import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isSameWeek, differenceInWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChevronLeft, ChevronRight, ArrowRight, CalendarIcon, ChevronDown, Home, Plane } from 'lucide-react';
import { Link } from 'react-router-dom';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

export function WeekOverview() {
  const { plans, availability, homeAddress } = usePlannerStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const weekDays = useMemo(() => {
    const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  const isCurrentWeek = isSameWeek(weekDays[0], new Date(), { weekStartsOn: 1 });

  const getSlotStatus = (date: Date, slot: TimeSlot) => {
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, date) && p.timeSlot === slot
    );
    if (hasPlan) return 'busy';
    const dayAvail = availability.find((a) => isSameDay(a.date, date));
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';
    return 'available';
  };

  const getPlansForSlot = (date: Date, slot: TimeSlot) => {
    return plans.filter((p) => isSameDay(p.date, date) && p.timeSlot === slot);
  };

  const getDayAvailability = (date: Date) => {
    return availability.find((a) => isSameDay(a.date, date));
  };

  const getDaySummary = (date: Date) => {
    const available = TIME_SLOT_ORDER.filter(s => getSlotStatus(date, s) === 'available').length;
    const busy = TIME_SLOT_ORDER.filter(s => getSlotStatus(date, s) === 'busy').length;
    const total = TIME_SLOT_ORDER.length;
    return { available, busy, total };
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return 'Next Week';
    return `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d')}`;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const today = new Date();
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const selectedWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weeksDiff = differenceInWeeks(selectedWeekStart, todayWeekStart);
    const newOffset = Math.max(0, Math.min(4, weeksDiff));
    setWeekOffset(newOffset);
    setCalendarOpen(false);
  };

  const toggleDay = (key: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-soft">
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border border-border shadow-lg z-50" align="start">
                <Calendar
                  mode="single"
                  selected={weekDays[0]}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    const today = new Date();
                    const maxDate = addWeeks(today, 4);
                    return date < startOfWeek(today, { weekStartsOn: 1 }) || date > maxDate;
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(prev => prev - 1)}
              disabled={weekOffset <= 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="font-display text-base font-semibold min-w-[100px] text-center">
              {getWeekLabel()}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(prev => prev + 1)}
              disabled={weekOffset >= 4}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Link to="/availability">
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
              Edit
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {!isCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-xs text-primary h-6 px-2"
            onClick={() => setWeekOffset(0)}
          >
            ← Back to this week
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {weekDays.map((day) => {
          const key = day.toISOString();
          const isToday = isSameDay(day, new Date());
          const dayAvail = getDayAvailability(day);
          const isAway = dayAvail?.locationStatus === 'away';
          const locationLabel = dayAvail?.tripLocation || homeAddress || undefined;
          const summary = getDaySummary(day);
          const isExpanded = expandedDays.has(key);
          const score = summary.available / summary.total;

          return (
            <div key={key}>
              {/* Clickable summary header */}
              <button
                onClick={() => toggleDay(key)}
                className={cn(
                  "w-full text-left rounded-xl p-2.5 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "text-sm font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'EEE')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(day, 'MMM d')}
                    </span>
                    {isToday && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                        Today
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                    isExpanded && "rotate-180"
                  )} />
                </div>

                {/* Availability bar */}
                <div className="mt-2 flex gap-0.5">
                  {TIME_SLOT_ORDER.map((slot) => {
                    const status = getSlotStatus(day, slot);
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          status === 'available' && "bg-availability-available/60",
                          status === 'busy' && "bg-primary/60",
                          status === 'unavailable' && "bg-muted-foreground/20"
                        )}
                      />
                    );
                  })}
                </div>

                {/* Summary line */}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={cn(
                    "text-[11px] font-medium",
                    score >= 0.5 ? "text-availability-available" : "text-muted-foreground"
                  )}>
                    {summary.available} of {summary.total} free
                    {summary.busy > 0 && ` · ${summary.busy} plan${summary.busy > 1 ? 's' : ''}`}
                  </span>
                  {/* Location */}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {isAway ? (
                      <Plane className="h-3 w-3 shrink-0" />
                    ) : (
                      <Home className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate max-w-[80px]">
                      {isAway ? (locationLabel || 'Away') : (locationLabel || 'Home')}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded slot details */}
              {isExpanded && (
                <div className="space-y-1 animate-fade-in px-1 pb-1">
                  {TIME_SLOT_ORDER.map((slot) => {
                    const status = getSlotStatus(day, slot);
                    const slotPlans = getPlansForSlot(day, slot);
                    const slotInfo = TIME_SLOT_LABELS[slot];

                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                          status === 'available' && "bg-availability-available/20 text-foreground",
                          status === 'busy' && "bg-muted/60 text-foreground",
                          status === 'unavailable' && "bg-muted/30 text-muted-foreground"
                        )}
                      >
                        <span className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          status === 'available' && "bg-availability-available",
                          status === 'busy' && "bg-primary",
                          status === 'unavailable' && "bg-muted-foreground/40"
                        )} />
                        <span className="font-medium truncate">
                          {slotInfo.label}
                        </span>
                        <span className="text-muted-foreground ml-auto text-[10px] shrink-0">
                          {slotInfo.time}
                        </span>
                        {slotPlans.length > 0 && (
                          <span className="shrink-0 text-[10px]">
                            {(() => {
                              const cfg = ACTIVITY_CONFIG[slotPlans[0].activity as keyof typeof ACTIVITY_CONFIG];
                              return cfg?.icon || '📅';
                            })()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
