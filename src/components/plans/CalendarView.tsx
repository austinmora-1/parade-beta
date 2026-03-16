import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday as isDateToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '@/stores/plannerStore';
import { Plan } from '@/types/planner';
import { Plane } from 'lucide-react';
import { PlanCard } from './PlanCard';
import { useIsMobile } from '@/hooks/use-mobile';

interface CalendarViewProps {
  onEditPlan?: (plan: Plan) => void;
  onDeletePlan?: (id: string) => void;
  onCreatePlan?: (date: Date) => void;
}

export function CalendarView({ onEditPlan, onDeletePlan, onCreatePlan }: CalendarViewProps) {
  const { plans } = usePlannerStore();
  const isMobile = useIsMobile();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };

  const getPlansForDay = (date: Date) => {
    return plans
      .filter((p) => isSameDay(p.date, date))
      .sort((a, b) => (timeSlotOrder[a.timeSlot] ?? 0) - (timeSlotOrder[b.timeSlot] ?? 0));
  };

  // Get background color based on plan count (0 = green/available, more plans = grayer)
  const getDayBgColor = (planCount: number, isSelected: boolean, isToday: boolean): string => {
    if (isSelected) return 'bg-primary text-primary-foreground';
    if (isToday) return 'bg-availability-today/80 text-white';
    if (planCount === 0) return 'bg-availability-available/30';
    if (planCount === 1) return 'bg-muted/40';
    if (planCount === 2) return 'bg-muted/55';
    return 'bg-muted/65';
  };

  const selectedDayPlans = selectedDate ? getPlansForDay(selectedDate) : [];

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold md:text-2xl">
          {format(currentMonth, isMobile ? 'MMM yyyy' : 'MMMM yyyy')}
        </h2>
        <div className="flex gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card p-2 shadow-soft md:rounded-2xl md:p-4">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1 md:mb-2">
          {(isMobile ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((day, i) => (
            <div
              key={i}
              className="py-1 text-center text-[10px] font-medium text-muted-foreground md:text-sm md:py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1">
          {calendarDays.map((day) => {
            const dayPlans = getPlansForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isDateToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "aspect-square relative flex items-center justify-center rounded-lg transition-all text-xs md:text-sm",
                  !isCurrentMonth && "opacity-30",
                  getDayBgColor(dayPlans.length, !!isSelected, isToday),
                  !isSelected && !isToday && "hover:bg-muted"
                )}
              >
                <span className="font-medium">{format(day, 'd')}</span>
                {dayPlans.length > 0 && (
                  <span className={cn(
                    "absolute top-1 right-1 md:top-1.5 md:right-1.5 min-w-[14px] md:min-w-[16px] h-[14px] md:h-[16px] flex items-center justify-center rounded-full text-[9px] md:text-[10px] font-medium",
                    isSelected 
                      ? "bg-primary-foreground/80 text-primary" 
                      : isToday 
                        ? "bg-white/70 text-availability-today" 
                        : "bg-primary/70 text-primary-foreground"
                  )}>
                    {dayPlans.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details - Compact on mobile */}
      {selectedDate && (
        <div className="space-y-2 md:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold md:text-lg">
              {format(selectedDate, isMobile ? 'EEE, MMM d' : 'EEEE, MMMM d')}
            </h3>
            {onCreatePlan && (
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-1.5"
                onClick={() => onCreatePlan(selectedDate)}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Plan</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
          {selectedDayPlans.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {selectedDayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={onEditPlan}
                  onDelete={onDeletePlan}
                  compact={isMobile}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 text-center shadow-soft md:rounded-2xl md:p-6">
              <p className="text-sm text-muted-foreground md:text-base">No plans for this day</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
