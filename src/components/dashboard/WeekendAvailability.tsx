import { useMemo, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Home, Plane, ChevronDown } from 'lucide-react';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

export function WeekendAvailability() {
  const { plans, availabilityMap, homeAddress } = usePlannerStore();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const weekendDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return [addDays(start, 5), addDays(start, 6)];
  }, []);

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold">Weekend</h3>
        <Link to="/availability">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
            Edit
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {weekendDays.map((day) => {
          const key = day.toISOString();
          const isToday = isSameDay(day, new Date());
          const dayAvail = getDayAvailability(day);
          const isAway = dayAvail?.locationStatus === 'away';
          const locationLabel = dayAvail?.tripLocation || homeAddress || undefined;
          const summary = getDaySummary(day);
          const isExpanded = expandedDays.has(key);
          const score = summary.available / summary.total;

          return (
            <div key={key} className="space-y-1.5">
              {/* Clickable summary header */}
              <button
                onClick={() => toggleDay(key)}
                className="w-full text-left rounded-xl p-2.5 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                </div>

                {/* Location */}
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {isAway ? (
                    <Plane className="h-3 w-3 shrink-0" />
                  ) : (
                    <Home className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">
                    {isAway ? (locationLabel || 'Away') : (locationLabel || 'Home')}
                  </span>
                </div>
              </button>

              {/* Expanded slot details */}
              {isExpanded && (
                <div className="space-y-1 animate-fade-in pl-1 pr-1">
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
