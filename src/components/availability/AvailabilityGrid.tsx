import { useMemo, useState } from 'react';
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

export function AvailabilityGrid() {
  const { plans, availability, setAvailability } = usePlannerStore();
  const isMobile = useIsMobile();
  
  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  // For mobile: 7 days forward from today
  // For desktop: week view starting Monday
  const [mobileStartDate, setMobileStartDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDaySummaryOpen, setIsDaySummaryOpen] = useState(false);

  // Mobile uses 7 days forward from start date
  const mobileDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(mobileStartDate, i));
  }, [mobileStartDate]);

  // Desktop uses week view
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

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

  const getSlotStatus = (date: Date, slot: TimeSlot) => {
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, date) && p.timeSlot === slot
    );
    if (hasPlan) return 'busy';

    const dayAvail = availability.find((a) => isSameDay(a.date, date));
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';

    return 'available';
  };

  // Calculate day availability percentage (0-1)
  const getDayAvailability = (date: Date): number => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableCount = slots.filter(slot => getSlotStatus(date, slot) === 'available').length;
    return availableCount / slots.length;
  };

  // Get background color based on availability and today status
  const getDayBgColor = (availability: number, isSelected: boolean, isTodayDate: boolean): string => {
    if (isSelected) return 'bg-primary';
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

    const dayAvail = availability.find((a) => isSameDay(a.date, date));
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
        onClick={() => setMobileStartDate(addDays(mobileStartDate, -7))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex flex-1 gap-0.5">
        {mobileDays.map((day, index) => {
          const isTodayDate = isToday(day);
          const isSelected = index === selectedDayIndex;
          const dayAvail = getDayAvailability(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (index === selectedDayIndex) {
                  // Toggle dropdown if clicking the already selected day
                  setIsDaySummaryOpen(!isDaySummaryOpen);
                } else {
                  setSelectedDayIndex(index);
                  setIsDaySummaryOpen(true);
                }
              }}
              className={cn(
                "flex-1 flex flex-col items-center py-1.5 rounded-md transition-all min-w-0",
                getDayBgColor(dayAvail, isSelected, isTodayDate),
                isSelected && "text-primary-foreground",
                isTodayDate && !isSelected && "text-white",
                !isSelected && !isTodayDate && dayAvail === 0 && "text-muted-foreground",
                !isSelected && !isTodayDate && dayAvail > 0 && "text-foreground"
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
        onClick={() => setMobileStartDate(addDays(mobileStartDate, 7))}
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
                  getDayBgColor(dayAvail, isSelected || false, isTodayDate),
                  isSelected && "text-primary-foreground",
                  isTodayDate && !isSelected && "text-white",
                  !isSelected && !isTodayDate && dayAvail === 0 && "text-muted-foreground",
                  !isSelected && !isTodayDate && dayAvail > 0 && "text-foreground"
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
                    "absolute bottom-0.5 w-1 h-1 rounded-full",
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
          <div className="flex items-center gap-2">
            {viewMode === 'week' ? (
              <span className="text-sm font-medium">
                {format(mobileDays[selectedDayIndex], 'EEEE, MMM d')}
              </span>
            ) : (
              <span className="text-sm font-medium">
                {selectedDate ? format(selectedDate, 'EEEE, MMM d') : format(currentMonth, 'MMMM yyyy')}
              </span>
            )}
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
                  setMobileStartDate(new Date());
                  setSelectedDayIndex(0);
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
              <MobileCompactView day={mobileDays[selectedDayIndex]} />
              {isDaySummaryOpen && (
                <div className="mt-3">
                  <DaySummaryDropdown 
                    selectedDate={mobileDays[selectedDayIndex]} 
                    isOpen={isDaySummaryOpen}
                    onOpenChange={setIsDaySummaryOpen}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <MobileMonthView />
              {selectedDate && (
                <div className="mt-3">
                  <MobileCompactView day={selectedDate} />
                </div>
              )}
              {isDaySummaryOpen && selectedDate && (
                <div className="mt-3">
                  <DaySummaryDropdown 
                    selectedDate={selectedDate} 
                    isOpen={isDaySummaryOpen}
                    onOpenChange={setIsDaySummaryOpen}
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
                  {weekDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={cn(
                        "min-w-[100px] border-b border-border p-3 text-center text-sm font-medium",
                        isToday(day) && "bg-primary/5"
                      )}
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div
                        className={cn(
                          "mt-1 text-lg",
                          isToday(day) && "text-primary font-bold"
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
                            isToday(day) && "bg-primary/5"
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
      </div>
    </div>
  );
}
