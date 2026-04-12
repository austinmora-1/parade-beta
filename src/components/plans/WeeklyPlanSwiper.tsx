import { useMemo, useRef, useCallback, useState, Fragment } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, Merge, X, Pencil, Trash2, Share2 } from 'lucide-react';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Clock } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';

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
  onMergeSelected?: (planIds: string[]) => void;
  onSharePlan?: (plan: Plan) => void;
}

export function WeeklyPlanSwiper({ plans, weekOffset, onWeekChange, onEditPlan, onDeletePlan, onMergeSelected, onSharePlan }: WeeklyPlanSwiperProps) {
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      // Auto-exit select mode when nothing selected
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

      {/* Selection action banner */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">
                {selectedIds.size} plan{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={exitSelectMode}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedIds.size === 1 && onEditPlan && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-1" onClick={handleEditSelected}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              {selectedIds.size >= 1 && onMergeSelected && (
                <Button variant="outline" size="sm" className={cn("h-8 gap-1.5 text-xs flex-1", selectedIds.size === 1 && "border-primary/40 text-primary")} onClick={handleMerge}>
                  <Merge className="h-3.5 w-3.5" />
                  {selectedIds.size >= 2 ? `Merge (${selectedIds.size})` : 'Merge'}
                </Button>
              )}
              {selectedIds.size === 1 && onSharePlan && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-1" onClick={handleShareSelected}>
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              )}
              {onDeletePlan && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={handleDeleteSelected}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        navigate={navigate}
      />
    </div>
  );
}

// --- Collapsible past days section ---

function DayRow({ day, dayPlans, isToday, isPast, selectMode, selectedIds, toggleSelect, onEditPlan, onCardTap }: {
  day: Date;
  dayPlans: Plan[];
  isToday: boolean;
  isPast: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onEditPlan?: (plan: Plan) => void;
  onCardTap: (id: string) => void;
}) {
  const key = format(day, 'yyyy-MM-dd');
  return (
    <div className={cn("rounded-xl transition-colors", isPast && "opacity-50")}>
      <div className={cn("flex items-center gap-2 px-3 py-1.5 relative z-10", isToday && "text-primary")}>
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
      {dayPlans.length > 0 ? (
        <div className="px-3 mt-1 mb-3">
          <div className={cn(
            "flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1",
            dayPlans.length === 1 && "overflow-visible"
          )}>
            {dayPlans.map(plan => (
              <div key={plan.id} className={cn(
                "snap-start shrink-0",
                dayPlans.length === 1 ? "w-full" : "w-[85%]"
              )}>
                <PlanCardCompact
                  plan={plan}
                  selectMode={selectMode}
                  selected={selectedIds.has(plan.id)}
                  onTap={() => onCardTap(plan.id)}
                  onLongPress={() => onCardTap(plan.id)}
                />
              </div>
            ))}
          </div>
          {dayPlans.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-1.5">
              {dayPlans.map((_, idx) => (
                <div key={idx} className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 pb-2">
          <div className="h-[1px] bg-border/40 mx-7" />
        </div>
      )}
    </div>
  );
}

function PastDaysCollapsible({ weekDays, today, plansByDay, selectMode, selectedIds, toggleSelect, onEditPlan, onCardTap }: {
  weekDays: Date[];
  today: Date;
  plansByDay: Map<string, Plan[]>;
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onEditPlan?: (plan: Plan) => void;
  onCardTap: (id: string) => void;
}) {
  const [showPast, setShowPast] = useState(false);

  const pastDays = weekDays.filter(d => d < today && !isSameDay(d, today));
  const currentAndFutureDays = weekDays.filter(d => isSameDay(d, today) || d > today);
  const pastPlanCount = pastDays.reduce((sum, d) => sum + (plansByDay.get(format(d, 'yyyy-MM-dd'))?.length || 0), 0);

  return (
    <div className="space-y-1">
      {pastDays.length > 0 && (
        <button
          onClick={() => setShowPast(!showPast)}
          className="flex items-center gap-2 px-3 py-1.5 w-full text-left group"
        >
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            !showPast && "-rotate-90"
          )} />
          <span className="text-[11px] font-medium text-muted-foreground">
            {pastDays.length} past day{pastDays.length > 1 ? 's' : ''}
            {pastPlanCount > 0 && ` · ${pastPlanCount} plan${pastPlanCount > 1 ? 's' : ''}`}
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {showPast && pastDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayPlans = plansByDay.get(key) || [];
          return (
            <motion.div
              key={key}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <DayRow
                day={day}
                dayPlans={dayPlans}
                isToday={false}
                isPast={true}
                selectMode={selectMode}
                selectedIds={selectedIds}
                toggleSelect={toggleSelect}
                onEditPlan={onEditPlan}
                onCardTap={onCardTap}
                navigate={navigate}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {currentAndFutureDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const dayPlans = plansByDay.get(key) || [];
        const isToday = isSameDay(day, today);
        return (
          <DayRow
            key={key}
            day={day}
            dayPlans={dayPlans}
            isToday={isToday}
            isPast={false}
            selectMode={selectMode}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            onEditPlan={onEditPlan}
            onCardTap={onCardTap}
            navigate={navigate}
          />
        );
      })}
    </div>
  );
}

// Deck of cards component for multiple plans on same day
function DeckOfCards({ plans, selectMode, selectedIds, toggleSelect, onCardTap, navigate }: {
  plans: Plan[];
  selectMode: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  onCardTap: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef(0);

  const handleSwipeStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0 && activeIndex < plans.length - 1) setActiveIndex(i => i + 1);
      if (dx > 0 && activeIndex > 0) setActiveIndex(i => i - 1);
    }
  };

  return (
    <div
      className="relative"
      style={{ height: '124px' }}
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
    >
      {plans.map((plan, idx) => {
        const offset = idx - activeIndex;
        const isActive = idx === activeIndex;
        const isGone = offset < 0;

        return (
          <motion.div
            key={plan.id}
            className="absolute top-0 left-0"
            initial={false}
            animate={{
              x: isGone ? -20 : offset * 24,
              scale: isActive ? 1 : 1 - Math.abs(offset) * 0.04,
              opacity: isGone ? 0 : Math.max(0, 1 - Math.abs(offset) * 0.25),
              zIndex: plans.length - Math.abs(offset),
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ width: 'calc(100% - 48px)' }}
          >
            <PlanCardCompact
              plan={plan}
              selectMode={selectMode}
              selected={selectedIds.has(plan.id)}
              onTap={() => {
                if (!isActive) { setActiveIndex(idx); return; }
                onCardTap(plan.id);
              }}
              onLongPress={() => onCardTap(plan.id)}
            />
          </motion.div>
        );
      })}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1.5">
        {plans.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCardCompact({ plan, onTap, selectMode, selected, onLongPress }: {
  plan: Plan;
  onTap: () => void;
  selectMode: boolean;
  selected: boolean;
  onLongPress: () => void;
}) {
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
  const displayTitle = getPlanDisplayTitle(plan);
  const isTentative = plan.status === 'tentative';
  const isPendingRsvp = plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={cn(
        "w-full h-[100px] rounded-xl border bg-card p-3 text-left transition-all hover:bg-muted/50 active:scale-[0.99] shadow-lg ring-1 ring-white/5 flex flex-col",
        (isTentative || isPendingRsvp) && "border-dashed opacity-70",
        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {selectMode && (
          <Checkbox checked={selected} className="shrink-0" />
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={16} />
        </div>
        <span className="text-sm font-semibold truncate flex-1">{displayTitle}</span>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3 shrink-0" />
            {plan.startTime
              ? `${formatTime12(plan.startTime)}${plan.endTime ? ` – ${formatTime12(plan.endTime)}` : ''}`
              : timeSlotConfig.time}
          </div>
          {plan.location && (
            <div className="flex items-center gap-1 truncate min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{plan.location.name}</span>
            </div>
          )}
        </div>
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
