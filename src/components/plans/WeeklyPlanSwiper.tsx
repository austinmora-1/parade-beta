import { useMemo, useRef, useCallback, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay, differenceInCalendarWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Plan } from '@/types/planner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePlannerStore } from '@/stores/plannerStore';
import { PastDaysCollapsible } from './weekly-plan/DayRow';

interface WeeklyPlanSwiperProps {
  plans: Plan[];
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onEditPlan?: (plan: Plan) => void;
  onDeletePlan?: (id: string) => void;
  onMergeSelected?: (planIds: string[]) => void;
  onSharePlan?: (plan: Plan) => void;
}

export function WeeklyPlanSwiper({ plans, weekOffset, onWeekChange, onEditPlan, onDeletePlan, onMergeSelected, onSharePlan }: WeeklyPlanSwiperProps) {
  const availabilityMap = usePlannerStore((s) => s.availabilityMap);
  const homeAddress = usePlannerStore((s) => s.homeAddress);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleMerge = () => {
    if (selectedIds.size >= 1 && onMergeSelected) {
      onMergeSelected(Array.from(selectedIds));
      exitSelectMode();
    }
  };

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

  const handleCardTap = (planId: string) => {
    if (!selectMode) {
      setSelectMode(true);
      setSelectedIds(new Set([planId]));
    } else {
      toggleSelect(planId);
    }
  };

  const selectedPlans = useMemo(() => {
    return plans.filter(p => selectedIds.has(p.id));
  }, [plans, selectedIds]);

  const handleEditSelected = () => {
    if (selectedPlans.length === 1 && onEditPlan) {
      onEditPlan(selectedPlans[0]);
      exitSelectMode();
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPlans.length >= 1 && onDeletePlan) {
      for (const p of selectedPlans) onDeletePlan(p.id);
      exitSelectMode();
    }
  };

  const handleShareSelected = () => {
    if (selectedPlans.length === 1 && onSharePlan) {
      onSharePlan(selectedPlans[0]);
      exitSelectMode();
    }
  };

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
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 hover:bg-accent rounded-lg px-2 py-1 transition-colors">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">{weekLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={(date) => {
                if (date) {
                  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
                  const target = startOfWeek(date, { weekStartsOn: 1 });
                  const diff = differenceInCalendarWeeks(target, base, { weekStartsOn: 1 });
                  onWeekChange(diff);
                }
                setCalendarOpen(false);
              }}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {!isThisWeek && (
          <button
            onClick={() => onWeekChange(0)}
            className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Today
          </button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onWeekChange(weekOffset + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days with plan cards */}
      <PastDaysCollapsible
        weekDays={weekDays}
        today={today}
        plansByDay={plansByDay}
        selectMode={selectMode}
        selectedIds={selectedIds}
        toggleSelect={toggleSelect}
        onEditPlan={onEditPlan}
        onCardTap={handleCardTap}
        availabilityMap={availabilityMap}
        homeAddress={homeAddress}
        selectionActions={selectMode ? {
          selectedCount: selectedIds.size,
          onEdit: selectedIds.size === 1 && onEditPlan ? handleEditSelected : undefined,
          onMerge: selectedIds.size >= 1 && onMergeSelected ? handleMerge : undefined,
          onShare: selectedIds.size === 1 && onSharePlan ? handleShareSelected : undefined,
          onDelete: onDeletePlan ? handleDeleteSelected : undefined,
          onExit: exitSelectMode,
        } : undefined}
      />
    </div>
  );
}
