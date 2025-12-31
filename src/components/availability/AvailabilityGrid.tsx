import { useMemo, useState } from 'react';
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

export function AvailabilityGrid() {
  const { plans, availability, setAvailability } = usePlannerStore();
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">
          Week of {format(currentWeekStart, 'MMM d, yyyy')}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
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

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-availability-available-light" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted/50" />
          <span className="text-muted-foreground">Unavailable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-availability-busy-light" />
          <span className="text-muted-foreground">Has plans</span>
        </div>
      </div>
    </div>
  );
}
