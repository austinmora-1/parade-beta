import { useMemo, useState, useRef } from 'react';
import {
  format,
  addDays,
  startOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  // Mobile dropdown day selector
  const MobileDayDropdown = () => {
    const selectedDay = weekDays[selectedDayIndex];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 gap-2 text-sm font-medium">
            {format(selectedDay, 'EEE, MMM d')}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-popover">
          {weekDays.map((day, index) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = index === selectedDayIndex;
            return (
              <DropdownMenuItem
                key={day.toISOString()}
                onClick={() => setSelectedDayIndex(index)}
                className={cn(
                  "flex items-center justify-between",
                  isSelected && "bg-accent"
                )}
              >
                <span>{format(day, 'EEEE, MMM d')}</span>
                {isToday && (
                  <span className="text-xs text-primary font-medium">Today</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Mobile single day view - condensed
  const MobileDayView = () => {
    const selectedDay = weekDays[selectedDayIndex];
    return (
      <div className="space-y-1.5">
        {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => {
          const status = getSlotStatus(selectedDay, slot);
          return (
            <button
              key={slot}
              onClick={() => toggleSlot(selectedDay, slot)}
              disabled={status === 'busy'}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all",
                status === 'available' &&
                  "bg-availability-available-light hover:bg-availability-available/30",
                status === 'unavailable' &&
                  "bg-muted/50 hover:bg-muted",
                status === 'busy' &&
                  "bg-availability-busy-light cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  status === 'available' && "bg-availability-available",
                  status === 'unavailable' && "bg-muted-foreground/40",
                  status === 'busy' && "bg-availability-busy"
                )} />
                <div className="text-left">
                  <span className="text-sm font-medium">{TIME_SLOT_LABELS[slot].label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{TIME_SLOT_LABELS[slot].time}</span>
                </div>
              </div>
              <span className={cn(
                "text-xs font-medium",
                status === 'available' && "text-availability-available",
                status === 'unavailable' && "text-muted-foreground",
                status === 'busy' && "text-availability-busy"
              )}>
                {status === 'available' && 'Free'}
                {status === 'unavailable' && 'Busy'}
                {status === 'busy' && 'Plan'}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:rounded-2xl md:p-6">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between md:mb-6">
        {isMobile ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (selectedDayIndex === 0) {
                  setCurrentWeekStart(subWeeks(currentWeekStart, 1));
                  setSelectedDayIndex(6);
                } else {
                  setSelectedDayIndex(selectedDayIndex - 1);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <MobileDayDropdown />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (selectedDayIndex === 6) {
                  setCurrentWeekStart(addWeeks(currentWeekStart, 1));
                  setSelectedDayIndex(0);
                } else {
                  setSelectedDayIndex(selectedDayIndex + 1);
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <h3 className="font-display text-lg font-semibold">
            Week of {format(currentWeekStart, 'MMM d, yyyy')}
          </h3>
        )}
        <div className="flex gap-1 md:gap-2">
          {isMobile ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
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
          ) : (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-sm"
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
                className="h-9 w-9"
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <MobileDayView />
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

      {/* Legend - hidden on mobile for compactness */}
      <div className="mt-3 hidden flex-wrap items-center gap-6 text-sm md:mt-4 md:flex">
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
