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
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-[80px] rounded-xl p-2 text-left transition-all duration-200",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "ring-2 ring-primary ring-offset-2",
                      isToday && !isSelected && "bg-primary/10",
                      !isSelected && !isToday && "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayPlans.slice(0, 2).map((plan) => (
                        <PlanCard key={plan.id} plan={plan} compact />
                      ))}
                      {dayPlans.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          +{dayPlans.length - 2} more
                        </p>
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
