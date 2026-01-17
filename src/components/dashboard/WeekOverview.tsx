import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isSameWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, ArrowRight, CalendarPlus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export function WeekOverview() {
  const { plans, availability } = usePlannerStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  
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
    if (dayAvail && !dayAvail.slots[slot]) return 'busy';
    
    return 'available';
  };

  const getDayAvailabilityScore = (date: Date) => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableSlots = slots.filter(
      (slot) => getSlotStatus(date, slot) === 'available'
    ).length;
    return availableSlots / slots.length;
  };

  const TIME_SLOT_ORDER: TimeSlot[] = [
    'early-morning',
    'late-morning', 
    'early-afternoon',
    'late-afternoon',
    'evening',
    'late-night'
  ];

  const getDayPlans = (date: Date) => {
    return plans
      .filter((p) => isSameDay(p.date, date))
      .sort((a, b) => {
        const aIndex = TIME_SLOT_ORDER.indexOf(a.timeSlot as TimeSlot);
        const bIndex = TIME_SLOT_ORDER.indexOf(b.timeSlot as TimeSlot);
        return aIndex - bIndex;
      });
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === 1) return 'Next Week';
    return `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d')}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset(prev => prev - 1)}
            disabled={weekOffset <= 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-display text-lg font-semibold min-w-[120px] text-center">
            {getWeekLabel()}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={weekOffset >= 4}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 text-xs text-primary"
              onClick={() => setWeekOffset(0)}
            >
              Back to this week
            </Button>
          )}
        </div>
        <Link to="/availability">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            Edit
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const score = getDayAvailabilityScore(day);
          const isToday = isSameDay(day, new Date());
          const dayPlans = getDayPlans(day);
          const planCount = dayPlans.length;
          
          return (
            <Popover key={day.toISOString()}>
              <PopoverTrigger asChild>
                <button
                  className="flex flex-col items-center rounded-xl p-2 transition-all duration-200 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {format(day, 'EEE')}
                  </span>
                  
                  <div className="relative">
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      isToday 
                        ? "bg-availability-today text-white"
                        : score >= 0.7 
                          ? "bg-availability-available-light text-availability-available"
                          : score >= 0.3 && score < 0.7 
                            ? "bg-availability-partial-light text-availability-partial"
                            : "bg-availability-busy-light text-availability-busy"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {planCount > 0 && (
                      <span className={cn(
                        "absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                        score >= 0.7 && "bg-availability-available text-white",
                        score >= 0.3 && score < 0.7 && "bg-availability-partial text-white",
                        score < 0.3 && "bg-availability-busy text-white"
                      )}>
                        {planCount}
                      </span>
                    )}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-72 p-0 bg-card border border-border shadow-lg z-50" 
                align="center"
                sideOffset={8}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display font-semibold">
                      {format(day, 'EEEE, MMM d')}
                    </h4>
                    {isToday && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Today
                      </span>
                    )}
                  </div>

                  {dayPlans.length > 0 ? (
                    <div className="space-y-2">
                      {dayPlans.map((plan) => {
                        const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG];
                        return (
                          <div
                            key={plan.id}
                            className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
                          >
                            <div 
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                              style={{ backgroundColor: activityConfig ? `hsl(var(--${activityConfig.color}) / 0.2)` : undefined }}
                            >
                              {activityConfig?.icon || '📅'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{plan.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {TIME_SLOT_LABELS[plan.timeSlot as TimeSlot]?.label || plan.timeSlot}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <div className="rounded-full bg-muted p-3 mb-2">
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No plans yet</p>
                      <p className="text-xs text-muted-foreground/70">
                        {score >= 0.5 ? "You're available!" : "Limited availability"}
                      </p>
                    </div>
                  )}

                  <Link to="/plans" className="block mt-3">
                    <Button size="sm" variant="outline" className="w-full gap-2">
                      <CalendarPlus className="h-4 w-4" />
                      {dayPlans.length > 0 ? 'View All Plans' : 'Create a Plan'}
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
