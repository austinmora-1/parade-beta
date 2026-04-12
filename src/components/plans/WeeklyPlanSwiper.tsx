import { useMemo, useRef, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Clock } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

interface WeeklyPlanSwiperProps {
  plans: Plan[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onEditPlan?: (plan: Plan) => void;
  onDeletePlan?: (id: string) => void;
}

export function WeeklyPlanSwiper({ plans, weekOffset, onWeekChange, onEditPlan, onDeletePlan }: WeeklyPlanSwiperProps) {
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    return sameMonth
      ? `${format(weekStart, 'MMM d')} – ${format(end, 'd')}`
      : `${format(weekStart, 'MMM d')} – ${format(end, 'MMM d')}`;
  }, [weekStart]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const day of weekDays) {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, []);
    }
    for (const plan of plans) {
      const key = format(plan.date, 'yyyy-MM-dd');
      if (map.has(key)) {
        map.get(key)!.push(plan);
      }
    }
    // Sort each day's plans by time slot
    const slotOrder: Record<string, number> = {
      'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
      'late-afternoon': 3, 'evening': 4, 'late-night': 5,
    };
    for (const [, dayPlans] of map) {
      dayPlans.sort((a, b) => (slotOrder[a.timeSlot] ?? 0) - (slotOrder[b.timeSlot] ?? 0));
    }
    return map;
  }, [plans, weekDays]);

  const isThisWeek = weekOffset === 0;
  const today = new Date();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = null;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isHorizontal.current !== true) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      onWeekChange(weekOffset + (dx < 0 ? 1 : -1));
    }
  }, [weekOffset, onWeekChange]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isHorizontal.current === null) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > 10 || dy > 10) {
        isHorizontal.current = dx > dy;
      }
    }
  }, []);

  return (
    <div
      className="space-y-3"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{weekLabel}</span>
          {!isThisWeek && (
            <button
              onClick={() => onWeekChange(0)}
              className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days with plan cards */}
      <div className="space-y-1">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayPlans = plansByDay.get(key) || [];
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;

          return (
            <div key={key} className={cn("rounded-xl transition-colors", isPast && "opacity-50")}>
              {/* Day header */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5",
                isToday && "text-primary"
              )}>
                <span className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  isToday ? "text-primary font-semibold" : "text-muted-foreground"
                )}>
                  {format(day, 'EEEE')}
                </span>
              </div>

              {/* Plan cards - horizontal scroll */}
              {dayPlans.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto px-3 pb-2 snap-x snap-mandatory scrollbar-hide">
                  {dayPlans.map((plan) => (
                    <PlanCardCompact
                      key={plan.id}
                      plan={plan}
                      onTap={() => {
                        const planIsPast = (plan.endDate || plan.date) < new Date(new Date().setHours(0, 0, 0, 0));
                        if (planIsPast) {
                          navigate(`/plan/${plan.id}`);
                        } else {
                          onEditPlan?.(plan);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-3 pb-2">
                  <div className="h-[1px] bg-border/40 mx-7" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanCardCompact({ plan, onTap }: { plan: Plan; onTap: () => void }) {
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
  const displayTitle = getPlanDisplayTitle(plan);
  const isTentative = plan.status === 'tentative';
  const isPendingRsvp = plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';

  return (
    <button
      onClick={onTap}
      className={cn(
        "flex-shrink-0 w-[200px] snap-start rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:bg-muted/50 active:scale-[0.98] shadow-soft",
        (isTentative || isPendingRsvp) && "border-dashed opacity-70"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={16} />
        </div>
        <span className="text-sm font-semibold truncate flex-1">{displayTitle}</span>
      </div>

      <div className="space-y-0.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          {plan.startTime
            ? `${formatTime12(plan.startTime)}${plan.endTime ? ` – ${formatTime12(plan.endTime)}` : ''}`
            : timeSlotConfig.time}
        </div>
        {plan.location && (
          <div className="flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{plan.location.name}</span>
          </div>
        )}
        {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
          <div className="text-[10px] truncate">
            w/ {plan.participants.filter(p => p.role !== 'subscriber').map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {isPendingRsvp && (
        <span className="mt-1.5 inline-block rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          Pending RSVP
        </span>
      )}
    </button>
  );
}
