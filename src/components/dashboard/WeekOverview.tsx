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
import { CollapsibleWidget } from './CollapsibleWidget';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

export function WeekOverview({ standalone = false }: { standalone?: boolean } = {}) {
  const { plans, availabilityMap, homeAddress } = usePlannerStore();
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
    const dayAvail = availabilityMap[format(date, 'yyyy-MM-dd')];
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';
    return 'available';
  };

  const getPlansForSlot = (date: Date, slot: TimeSlot) => {
    return plans.filter((p) => isSameDay(p.date, date) && p.timeSlot === slot);
  };

  const getDayAvailability = (date: Date) => {
    return availabilityMap[format(date, 'yyyy-MM-dd')];
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

  const editButton = (
    <div onClick={(e) => e.stopPropagation()}>
      <Link to="/availability">
        <Button variant="outline" size="sm" className="gap-1 text-xs h-7 px-3 border-primary/30 text-primary hover:bg-primary/10">
          Edit
          <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );

  const weekNav = (
    <div className="flex items-center gap-0">
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
              const maxDate = addWeeks(today, 26);
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
        className="h-6 w-6"
        onClick={() => setWeekOffset(prev => prev - 1)}
        disabled={weekOffset <= 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium text-center text-muted-foreground whitespace-nowrap">
        {getWeekLabel()}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setWeekOffset(prev => prev + 1)}
        disabled={weekOffset >= 26}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentWeek && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary h-6 px-2"
          onClick={() => setWeekOffset(0)}
        >
          ← This week
        </Button>
      )}
    </div>
  );

  const content = (
    <>
      <div className="flex items-center mb-2">
        {weekNav}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {weekDays.map((day) => {
          const key = day.toISOString();
          const isToday = isSameDay(day, new Date());
          const dayAvail = getDayAvailability(day);
          const isAway = dayAvail?.locationStatus === 'away';
          const summary = getDaySummary(day);
          const isExpanded = expandedDays.has(key);
          const score = summary.available / summary.total;

          return (
            <div key={key}>
              <button
                onClick={() => toggleDay(key)}
                 className={cn(
                   "w-full text-left rounded-lg p-2 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                   isToday && !isAway && "bg-primary/10 ring-2 ring-primary/30",
                   isAway && "bg-availability-away/10 ring-2 ring-availability-away/30"
                 )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn(
                      "text-xs font-semibold",
                      isAway && "text-availability-away-foreground",
                      isToday && !isAway && "text-primary"
                    )}>
                      {format(day, 'EEE')}
                    </span>
                    <span className={cn(
                      "text-[11px]",
                      isAway ? "text-orange-600" : "text-muted-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {isToday && (
                      <span className={cn(
                        "text-[9px] px-1 py-0.5 rounded-full font-medium",
                        isAway ? "bg-orange-500/10 text-orange-600" : "bg-primary/10 text-primary"
                      )}>
                        Today
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                    isExpanded && "rotate-180"
                  )} />
                </div>

                <div className="mt-1.5 flex gap-0.5">
                  {TIME_SLOT_ORDER.map((slot) => {
                    const status = getSlotStatus(day, slot);
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "h-1 flex-1 rounded-full",
                          status === 'available' && "bg-availability-available/60",
                          status === 'busy' && "bg-primary/60",
                          status === 'unavailable' && "bg-muted-foreground/20"
                        )}
                      />
                    );
                  })}
                </div>

                <div className="mt-1 flex items-center justify-between">
                  <span className={cn(
                    "text-[10px] font-medium",
                    isAway ? "text-orange-600" : score >= 0.5 ? "text-availability-available" : "text-muted-foreground"
                  )}>
                    {summary.available}/{summary.total} free
                    {summary.busy > 0 && ` · ${summary.busy} ${summary.busy === 1 ? 'plan' : 'plans'}`}
                  </span>
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px]",
                    isAway ? "text-orange-600" : "text-muted-foreground"
                  )}>
                    {isAway ? (
                      <Plane className="h-2.5 w-2.5 shrink-0" />
                    ) : (
                      <Home className="h-2.5 w-2.5 shrink-0" />
                    )}
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-0.5 animate-fade-in px-0.5 pb-1">
                  {TIME_SLOT_ORDER.map((slot) => {
                    const status = getSlotStatus(day, slot);
                    const slotPlans = getPlansForSlot(day, slot);
                    const slotInfo = TIME_SLOT_LABELS[slot];

                    return (
                      <div
                        key={slot}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
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
                        <span className="text-muted-foreground ml-auto text-[9px] shrink-0">
                          {slotInfo.time}
                        </span>
                        {slotPlans.length > 0 && (
                          <span className="shrink-0 text-[9px]">
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
    </>
  );

  if (standalone) {
    return <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">{content}</div>;
  }

  return (
    <CollapsibleWidget
      title="Week Overview"
      icon={<CalendarIcon className="h-4 w-4 text-primary" />}
      headerRight={editButton}
    >
      {content}
    </CollapsibleWidget>
  );
}
