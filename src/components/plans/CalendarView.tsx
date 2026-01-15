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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '@/stores/plannerStore';
import { Plan } from '@/types/planner';
import { PlanCard } from './PlanCard';

interface CalendarViewProps {
  onEditPlan?: (plan: Plan) => void;
  onDeletePlan?: (id: string) => void;
}

export function CalendarView({ onEditPlan, onDeletePlan }: CalendarViewProps) {
  const { plans } = usePlannerStore();
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

  const getPlansForDay = (date: Date) => {
    return plans.filter((p) => isSameDay(p.date, date));
  };

  // Get background color based on plan count (0 = green/available, more plans = grayer)
  const getDayBgColor = (planCount: number, isSelected: boolean, isToday: boolean): string => {
    if (isSelected) return 'bg-primary/10 ring-2 ring-primary ring-offset-2';
    if (isToday) return 'bg-availability-today';
    if (planCount === 0) return 'bg-availability-available/40 hover:bg-availability-available/50';
    if (planCount === 1) return 'bg-availability-available/20 hover:bg-availability-available/30';
    if (planCount === 2) return 'bg-muted/40 hover:bg-muted/60';
    return 'bg-muted/70 hover:bg-muted/80';
  };

  const selectedDayPlans = selectedDate ? getPlansForDay(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            {/* Day Headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
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
                      "min-h-[60px] rounded-xl p-2 text-left transition-all duration-200",
                      !isCurrentMonth && "opacity-40",
                      getDayBgColor(dayPlans.length, !!isSelected, isToday)
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                          isToday && "text-white",
                          isSelected && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayPlans.length > 0 && (
                        <span className={cn(
                          "text-xs font-medium rounded-full px-1.5 py-0.5",
                          dayPlans.length >= 3 ? "bg-muted-foreground/20 text-muted-foreground" : "text-muted-foreground"
                        )}>
                          {dayPlans.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="space-y-4">
          {selectedDate ? (
            <>
              <h3 className="font-display text-lg font-semibold">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>
              {selectedDayPlans.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onEdit={onEditPlan}
                      onDelete={onDeletePlan}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
                  <p className="text-muted-foreground">No plans for this day</p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
              <p className="text-muted-foreground">Select a day to view plans</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
