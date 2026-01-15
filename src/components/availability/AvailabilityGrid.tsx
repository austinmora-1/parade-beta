import { useMemo, useState, useRef } from 'react';
import {
  format,
  addDays,
  startOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { useIsMobile } from '@/hooks/use-mobile';

export function AvailabilityGrid() {
  const { plans, availability, setAvailability } = usePlannerStore();
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const diffDays = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(Math.max(diffDays, 0), 6);
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const getSlotStatus = (date: Date, slot: TimeSlot) => {
    // Check if there's a plan during this slot
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, date) && p.timeSlot === slot
    );
    if (hasPlan) return 'busy';

    // Check availability setting
    const dayAvail = availability.find((a) => isSameDay(a.date, date));
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';

    return 'available';
  };

  const toggleSlot = (date: Date, slot: TimeSlot) => {
    const currentStatus = getSlotStatus(date, slot);
    if (currentStatus === 'busy') return; // Can't toggle if there's a plan

    const dayAvail = availability.find((a) => isSameDay(a.date, date));
    const isCurrentlyAvailable = dayAvail ? dayAvail.slots[slot] : true;
    setAvailability(date, slot, !isCurrentlyAvailable);
  };

  // Mobile day selector component
  const MobileDaySelector = () => (
    <div className="mb-4 flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
      {weekDays.map((day, index) => {
        const isToday = isSameDay(day, new Date());
        const isSelected = index === selectedDayIndex;
        return (
          <button
            key={day.toISOString()}
            onClick={() => setSelectedDayIndex(index)}
            className={cn(
              "flex min-w-[48px] flex-col items-center rounded-xl px-3 py-2 transition-all",
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                ? "bg-primary/10 text-primary"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="text-[10px] font-medium uppercase">{format(day, 'EEE')}</span>
            <span className={cn(
              "text-lg font-bold",
              isSelected && "text-primary-foreground"
            )}>
              {format(day, 'd')}
            </span>
          </button>
        );
      })}
    </div>
  );

  // Mobile single day view
  const MobileDayView = () => {
    const selectedDay = weekDays[selectedDayIndex];
    return (
      <div className="space-y-2">
        {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => {
          const status = getSlotStatus(selectedDay, slot);
          return (
            <button
              key={slot}
              onClick={() => toggleSlot(selectedDay, slot)}
              disabled={status === 'busy'}
              className={cn(
                "flex w-full items-center justify-between rounded-xl p-4 transition-all",
                status === 'available' &&
                  "bg-availability-available-light hover:bg-availability-available/30",
                status === 'unavailable' &&
                  "bg-muted/50 hover:bg-muted",
                status === 'busy' &&
                  "bg-availability-busy-light cursor-not-allowed"
              )}
            >
              <div className="text-left">
                <div className="text-sm font-medium">{TIME_SLOT_LABELS[slot].label}</div>
                <div className="text-xs text-muted-foreground">{TIME_SLOT_LABELS[slot].time}</div>
              </div>
              <div className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium",
                status === 'available' && "bg-availability-available/20 text-availability-available",
                status === 'unavailable' && "bg-muted text-muted-foreground",
                status === 'busy' && "bg-availability-busy/20 text-availability-busy"
              )}>
                {status === 'available' && 'Free'}
                {status === 'unavailable' && 'Busy'}
                {status === 'busy' && 'Has plan'}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft md:rounded-2xl md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h3 className="font-display text-base font-semibold md:text-lg">
          {isMobile ? format(weekDays[selectedDayIndex], 'MMMM d') : `Week of ${format(currentWeekStart, 'MMM d, yyyy')}`}
        </h3>
        <div className="flex gap-1 md:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={() => {
              setCurrentWeekStart(subWeeks(currentWeekStart, 1));
              if (isMobile) setSelectedDayIndex(6);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm"
            onClick={() => {
              setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
              const today = new Date();
              const weekStart = startOfWeek(today, { weekStartsOn: 1 });
              const diffDays = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
              setSelectedDayIndex(Math.min(Math.max(diffDays, 0), 6));
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={() => {
              setCurrentWeekStart(addWeeks(currentWeekStart, 1));
              if (isMobile) setSelectedDayIndex(0);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <>
          <MobileDaySelector />
          <MobileDayView />
        </>
      ) : (
        /* Desktop Grid */
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-32 border-b border-border p-3 text-left text-sm font-medium text-muted-foreground">
                  Time Slot
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className={cn(
                      "min-w-[100px] border-b border-border p-3 text-center text-sm font-medium",
                      isSameDay(day, new Date()) && "bg-primary/5"
                    )}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div
                      className={cn(
                        "mt-1 text-lg",
                        isSameDay(day, new Date()) && "text-primary font-bold"
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
                <tr key={slot}>
                  <td className="border-b border-border p-3">
                    <div className="text-sm font-medium">
                      {TIME_SLOT_LABELS[slot].label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {TIME_SLOT_LABELS[slot].time}
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const status = getSlotStatus(day, slot);
                    return (
                      <td
                        key={`${day.toISOString()}-${slot}`}
                        className={cn(
                          "border-b border-border p-2",
                          isSameDay(day, new Date()) && "bg-primary/5"
                        )}
                      >
                        <button
                          onClick={() => toggleSlot(day, slot)}
                          disabled={status === 'busy'}
                          className={cn(
                            "h-12 w-full rounded-lg transition-all duration-200",
                            status === 'available' &&
                              "bg-availability-available-light hover:bg-availability-available/30",
                            status === 'unavailable' &&
                              "bg-muted/50 hover:bg-muted",
                            status === 'busy' &&
                              "bg-availability-busy-light cursor-not-allowed"
                          )}
                        >
                          {status === 'busy' && (
                            <span className="text-xs font-medium text-availability-busy">
                              Busy
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs md:gap-6 md:text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-availability-available-light md:h-4 md:w-4" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted/50 md:h-4 md:w-4" />
          <span className="text-muted-foreground">Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-availability-busy-light md:h-4 md:w-4" />
          <span className="text-muted-foreground">Has plans</span>
        </div>
      </div>
    </div>
  );
}
