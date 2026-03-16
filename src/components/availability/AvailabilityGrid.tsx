import { useMemo, useState } from 'react';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import {
  format,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
  getDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { useIsMobile } from '@/hooks/use-mobile';
import { DaySummaryDropdown } from './DaySummaryDropdown';

type ViewMode = 'week' | 'month';

interface AvailabilityGridProps {
  onCreatePlan?: (date: Date) => void;
}

export function AvailabilityGrid({ onCreatePlan }: AvailabilityGridProps) {
  const { plans, availability, availabilityMap, setAvailability, homeAddress } = usePlannerStore();
  const isMobile = useIsMobile();
  
  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  // For mobile: 7 days forward from today
  // For desktop: week view starting Monday
  // Both mobile and desktop use Monday-Sunday weeks
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Default to today's index within the week (0=Mon, 6=Sun)
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const diff = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(6, diff));
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDaySummaryOpen, setIsDaySummaryOpen] = useState(false);

  // Both mobile and desktop use the same Mon-Sun week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Month calendar days

  // Month calendar days
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDay = getDay(start);
    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the month starts
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    
    return days;
  }, [currentMonth]);

  // Check if a day has "away" location status
  const isDayAway = (date: Date): boolean => {
    const dayAvail = availabilityMap[format(date, 'yyyy-MM-dd')];
    return dayAvail?.locationStatus === 'away';
  };

  const getSlotStatus = (date: Date, slot: TimeSlot) => {
    // Exclude plans where the user is only a subscriber (view-only)
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, date) && p.timeSlot === slot && p.myRole !== 'subscriber'
    );
    if (hasPlan) return 'busy';

    const dayAvail = availabilityMap[format(date, 'yyyy-MM-dd')];
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';

    return 'available';
  };

  // Get location text for a date
  const getLocationText = (date: Date): string | undefined => {
    const dayAvail = availabilityMap[format(date, 'yyyy-MM-dd')];
    if (dayAvail?.tripLocation) {
      return dayAvail.tripLocation;
    }
    return homeAddress || undefined;
  };

  // Calculate day availability percentage (0-1)
  const getDayAvailability = (date: Date): number => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableCount = slots.filter(slot => getSlotStatus(date, slot) === 'available').length;
    return availableCount / slots.length;
  };

  // Check if a day is in the past (before today)
  const isDayPast = (date: Date): boolean => {
    return isBefore(startOfDay(date), startOfDay(new Date()));
  };

  // Get background color based on availability, today status, away status, and past status
  const getDayBgColor = (availability: number, isSelected: boolean, isTodayDate: boolean, isAway: boolean, isPast: boolean): string => {
    if (isSelected) return isAway ? 'bg-availability-away' : isPast ? 'bg-muted-foreground/50' : 'bg-primary';
    if (isPast) return 'bg-muted/40';
    if (isAway) return 'bg-availability-away/20';
    if (isTodayDate) return 'bg-availability-today';
    
    // Gray to green gradient based on availability
    if (availability === 0) return 'bg-muted';
    if (availability <= 0.17) return 'bg-availability-available/15';
    if (availability <= 0.33) return 'bg-availability-available/25';
    if (availability <= 0.5) return 'bg-availability-available/40';
    if (availability <= 0.67) return 'bg-availability-available/55';
    if (availability <= 0.83) return 'bg-availability-available/70';
    return 'bg-availability-available/85';
  };

  const toggleSlot = (date: Date, slot: TimeSlot) => {
    const currentStatus = getSlotStatus(date, slot);
    if (currentStatus === 'busy') return;

    const dayAvail = availabilityMap[format(date, 'yyyy-MM-dd')];
    const isCurrentlyAvailable = dayAvail ? dayAvail.slots[slot] : true;
    setAvailability(date, slot, !isCurrentlyAvailable);
  };

  // Compact mobile week strip
  const MobileWeekStrip = () => (
    <div className="flex items-center gap-1 mb-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex flex-1 gap-0.5">
        {weekDays.map((day, index) => {
           const isTodayDate = isToday(day);
           const isSelected = index === selectedDayIndex;
           const dayAvail = getDayAvailability(day);
           const isAway = isDayAway(day);
           const isPast = isDayPast(day);
           return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (index === selectedDayIndex) {
                  setIsDaySummaryOpen(!isDaySummaryOpen);
                } else {
                  setSelectedDayIndex(index);
                  setIsDaySummaryOpen(true);
                }
              }}
              className={cn(
                "flex-1 flex flex-col items-center py-1.5 rounded-md transition-all min-w-0",
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                getDayBgColor(dayAvail, isSelected, isTodayDate, isAway, isPast),
                isSelected && "text-primary-foreground",
                !isSelected && isPast && "text-muted-foreground/60",
                !isSelected && !isPast && isAway && "text-orange-600",
                isTodayDate && !isSelected && !isAway && "text-white",
                !isSelected && !isTodayDate && !isPast && !isAway && dayAvail === 0 && "text-muted-foreground",
                !isSelected && !isTodayDate && !isPast && !isAway && dayAvail > 0 && "text-foreground"
              )}
            >
              <span className="text-[10px] font-medium uppercase leading-none">
                {format(day, 'EEE').charAt(0)}
              </span>
              <span className="text-sm font-semibold leading-tight">
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // Ultra-compact time slot grid for mobile
  const MobileCompactView = ({ day }: { day: Date }) => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    
    return (
      <div className="grid grid-cols-3 gap-1">
        {slots.map((slot) => {
          const status = getSlotStatus(day, slot);
          return (
            <button
              key={slot}
              onClick={() => toggleSlot(day, slot)}
              disabled={status === 'busy'}
              className={cn(
                "flex flex-col items-center justify-center rounded-md py-1.5 px-1 transition-all",
                status === 'available' &&
                  "bg-availability-available-light hover:bg-availability-available/30 active:scale-95",
                status === 'unavailable' &&
                  "bg-muted/50 hover:bg-muted active:scale-95",
                status === 'busy' &&
                  "bg-availability-busy-light cursor-not-allowed opacity-60"
              )}
            >
              <span className={cn(
                "text-[11px] font-medium leading-tight",
                status === 'available' && "text-availability-available",
                status === 'unavailable' && "text-muted-foreground",
                status === 'busy' && "text-availability-busy"
              )}>
                {TIME_SLOT_LABELS[slot].label}
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight">
                {TIME_SLOT_LABELS[slot].time}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // Month calendar grid for mobile
  const MobileMonthView = () => {
    const weekDayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    
    return (
      <div className="space-y-2">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Week day headers */}
          {weekDayLabels.map((label, i) => (
            <div key={`header-${i}`} className="flex flex-col items-center justify-center py-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                {label}
              </span>
            </div>
          ))}
          
          {/* Day cells */}
          {monthDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="py-1.5" />;
            }
            
            const isTodayDate = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayAvail = getDayAvailability(day);
            const hasPlan = plans.some(p => isSameDay(p.date, day));
            const isAway = isDayAway(day);
            const isPast = isDayPast(day);
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  if (selectedDate && isSameDay(day, selectedDate)) {
                    setIsDaySummaryOpen(!isDaySummaryOpen);
                  } else {
                    setSelectedDate(day);
                    setIsDaySummaryOpen(true);
                  }
                }}
                className={cn(
                  "flex flex-col items-center py-1.5 rounded-md transition-all relative",
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  getDayBgColor(dayAvail, isSelected || false, isTodayDate, isAway, isPast),
                  isSelected && "text-primary-foreground",
                  !isSelected && isPast && "text-muted-foreground/60",
                  !isSelected && !isPast && isAway && "text-orange-600",
                  isTodayDate && !isSelected && !isAway && "text-white",
                  !isSelected && !isTodayDate && !isPast && !isAway && dayAvail === 0 && "text-muted-foreground",
                  !isSelected && !isTodayDate && !isPast && !isAway && dayAvail > 0 && "text-foreground"
                )}
              >
                <span className="text-[10px] font-medium uppercase leading-none">
                  {format(day, 'EEE').charAt(0)}
                </span>
                <span className="text-sm font-semibold leading-tight">
                  {format(day, 'd')}
                </span>
                {hasPlan && (
                  <div className={cn(
                    "absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-primary"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:rounded-2xl md:p-6">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between md:mb-6">
        {isMobile ? (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {viewMode === 'week' ? (
                <span className="text-sm font-medium">
                  {format(weekDays[selectedDayIndex], 'EEEE, MMM d')}
                </span>
              ) : (
                <span className="text-sm font-medium">
                  {selectedDate ? format(selectedDate, 'EEEE, MMM d') : format(currentMonth, 'MMMM yyyy')}
                </span>
              )}
            </div>
            {(() => {
              const activeDate = viewMode === 'week' ? weekDays[selectedDayIndex] : selectedDate;
              const loc = activeDate ? getLocationText(activeDate) : undefined;
              return loc ? (
                <span className="text-[11px] font-medium text-muted-foreground">{loc}</span>
              ) : null;
            })()}
          </div>
        ) : (
          <h3 className="font-display text-lg font-semibold">
            Week of {format(currentWeekStart, 'MMM d, yyyy')}
          </h3>
        )}
        <div className="flex items-center gap-1">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setViewMode(viewMode === 'week' ? 'month' : 'week');
                setIsDaySummaryOpen(false);
                setSelectedDate(null);
              }}
            >
              {viewMode === 'week' ? (
                <Calendar className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary"
            onClick={() => {
              if (isMobile) {
                if (viewMode === 'week') {
                  setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
                  const today = new Date();
                  const ws = startOfWeek(today, { weekStartsOn: 1 });
                  const diff = Math.floor((today.getTime() - ws.getTime()) / (1000 * 60 * 60 * 24));
                  setSelectedDayIndex(Math.max(0, Math.min(6, diff)));
                } else {
                  setCurrentMonth(new Date());
                  setSelectedDate(new Date());
                }
              } else {
                setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
              }
            }}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Mobile View */}
      {isMobile ? (
        <>
          {viewMode === 'week' ? (
            <>
              <MobileWeekStrip />
              <DaySummaryDropdown 
                selectedDate={weekDays[selectedDayIndex]} 
                isOpen={true}
                onOpenChange={() => {}}
              />
            </>
          ) : (
            <>
              <MobileMonthView />
              {selectedDate && (
                <div className="mt-3">
                  <DaySummaryDropdown 
                    selectedDate={selectedDate} 
                    isOpen={true}
                    onOpenChange={() => setSelectedDate(null)}
                  />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* Desktop Grid */
        <>
          <div className="mb-4 flex justify-end gap-2">
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
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-32 border-b border-border p-3 text-left text-sm font-medium text-muted-foreground">
                    Time Slot
                  </th>
                  {weekDays.map((day) => {
                    const isAway = isDayAway(day);
                    const isPast = isDayPast(day);
                    return (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "min-w-[100px] border-b border-border p-3 text-center text-sm font-medium",
                        isPast && "opacity-50",
                        isToday(day) && !isAway && "bg-primary/5",
                        isAway && !isPast && "bg-orange-500/10"
                      )}
                    >
                      <div className={cn(isPast && "text-muted-foreground", !isPast && isAway && "text-orange-600")}>{format(day, 'EEE')}</div>
                      <div
                        className={cn(
                          "mt-1 text-lg",
                          isPast && "text-muted-foreground",
                          !isPast && isAway && "text-orange-600 font-bold",
                          isToday(day) && !isAway && "text-primary font-bold"
                        )}
                      >
                        {format(day, 'd')}
                      </div>
                      {getLocationText(day) && (
                        <div className={cn(
                          "mt-0.5 text-[10px] font-medium truncate max-w-[90px]",
                          isAway ? "text-orange-600" : "text-muted-foreground"
                        )}>
                          {getLocationText(day)}
                        </div>
                      )}
                    </th>
                    );
                  })}
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
                      const isPast = isDayPast(day);
                      return (
                        <td
                          key={`${day.toISOString()}-${slot}`}
                          className={cn(
                            "border-b border-border p-2",
                            isPast && "opacity-50",
                            isToday(day) && "bg-primary/5"
                          )}
                        >
                          <button
                            onClick={() => toggleSlot(day, slot)}
                            disabled={status === 'busy' || isPast}
                            className={cn(
                              "h-12 w-full rounded-lg transition-all duration-200 flex flex-col items-center justify-center gap-0.5",
                              status === 'available' &&
                                "bg-availability-available-light hover:bg-availability-available/30",
                              status === 'unavailable' &&
                                "bg-muted/50 hover:bg-muted",
                              status === 'busy' &&
                                "bg-availability-busy-light cursor-not-allowed"
                            )}
                          >
                            {status === 'busy' && (() => {
                              const slotPlan = plans.find(
                                (p) => isSameDay(p.date, day) && p.timeSlot === slot
                              );
                              return slotPlan ? (
                                <>
                                  <span className="text-xs font-medium text-availability-busy truncate max-w-[90px]">
                                    {getPlanDisplayTitle(slotPlan)}
                                  </span>
                                  {slotPlan.participants.length > 0 && (
                                    <span className="text-[10px] text-availability-busy/70 truncate max-w-[90px]">
                                      w/ {slotPlan.participants.map(p => p.name).join(', ')}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs font-medium text-availability-busy">Busy</span>
                              );
                            })()}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Legend - hidden on mobile */}
      <div className="mt-4 hidden flex-wrap items-center gap-6 text-sm md:flex">
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
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-orange-500/20" />
          <span className="text-muted-foreground">Away</span>
        </div>
      </div>
    </div>
  );
}
