import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, isSameWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function WeekOverview() {
  const { plans, availability } = usePlannerStore();
  const [weekOffset, setWeekOffset] = useState(0);
  
  const weekDays = useMemo(() => {
    const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  const isCurrentWeek = isSameWeek(weekDays[0], new Date(), { weekStartsOn: 1 });

  const getSlotStatus = (date: Date, slot: TimeSlot) => {
    // Check if there's a plan during this slot
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, date) && p.timeSlot === slot
    );
    
    if (hasPlan) return 'busy';
    
    // Check availability setting
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
          const dayPlans = plans.filter((p) => isSameDay(p.date, day));
          const planCount = dayPlans.length;
          
          return (
            <Link
              to="/plans"
              key={day.toISOString()}
              className="flex flex-col items-center rounded-xl p-2 transition-all duration-200 hover:bg-muted/50"
            >
              <span className="text-xs font-medium text-muted-foreground mb-1">
                {format(day, 'EEE')}
              </span>
              
              {/* Date circle with plan count bubble */}
              <div className="relative">
                {/* Date circle */}
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
                
                {/* Plan count bubble */}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
