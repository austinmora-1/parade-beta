import { useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';

export function WeekOverview() {
  const { plans, availability } = usePlannerStore();
  
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">This Week</h3>
        <span className="text-sm text-muted-foreground">
          {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d')}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const score = getDayAvailabilityScore(day);
          const isToday = isSameDay(day, new Date());
          const dayPlans = plans.filter((p) => isSameDay(p.date, day));
          const planCount = dayPlans.length;
          
          return (
            <div
              key={day.toISOString()}
              className="flex flex-col items-center rounded-xl p-2 transition-all duration-200"
            >
              <span className="text-xs font-medium text-muted-foreground mb-1">
                {format(day, 'EEE')}
              </span>
              
              {/* Date circle with plan count bubble */}
              <div className="relative">
                {/* Date circle */}
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isToday && "ring-2 ring-primary ring-offset-1",
                  score >= 0.7 && "bg-availability-available-light text-availability-available",
                  score >= 0.3 && score < 0.7 && "bg-availability-partial-light text-availability-partial",
                  score < 0.3 && "bg-availability-busy-light text-availability-busy"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
