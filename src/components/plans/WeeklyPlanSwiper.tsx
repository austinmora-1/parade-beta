import { useMemo, useRef, useCallback, useState, useEffect, Fragment } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown, Merge, X, Pencil, Trash2, Share2 } from 'lucide-react';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Clock } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
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
            <div className="flex items-center gap-1">
              {selectedIds.size === 1 && onEditPlan && (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px] flex-1 min-w-0" onClick={handleEditSelected}>
                  <Pencil className="h-3 w-3 shrink-0" />
                  Edit
                </Button>
              )}
              {selectedIds.size >= 1 && onMergeSelected && (
                <Button variant="outline" size="sm" className={cn("h-7 gap-1 px-2 text-[11px] flex-1 min-w-0", selectedIds.size === 1 && "border-primary/40 text-primary")} onClick={handleMerge}>
                  <Merge className="h-3 w-3 shrink-0" />
                  {selectedIds.size >= 2 ? `Merge` : 'Merge'}
                </Button>
              )}
              {selectedIds.size === 1 && onSharePlan && (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px] flex-1 min-w-0" onClick={handleShareSelected}>
                  <Share2 className="h-3 w-3 shrink-0" />
                  Share
                </Button>
              )}
              {onDeletePlan && (
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px] flex-1 min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={handleDeleteSelected}>
                  <Trash2 className="h-3 w-3 shrink-0" />
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
        {dayPlans.length > 1 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
            {dayPlans.length}
          </span>
        )}
      </div>
      {dayPlans.length > 0 ? (
        <div className="px-3 mt-1 mb-3">
          {dayPlans.length === 1 ? (
            <PlanCardCompact
              plan={dayPlans[0]}
              selectMode={selectMode}
              selected={selectedIds.has(dayPlans[0].id)}
              onTap={() => onCardTap(dayPlans[0].id)}
              onLongPress={() => onCardTap(dayPlans[0].id)}
            />
          ) : (
            <SwipeStack
              plans={dayPlans}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onCardTap={onCardTap}
            />
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
          />
        );
      })}
    </div>
  );
}

// Map time slots to approximate hour ranges for determining past/current/upcoming
const TIME_SLOT_HOURS: Record<string, { start: number; end: number }> = {
  'early-morning': { start: 6, end: 9 },
  'late-morning': { start: 9, end: 12 },
  'early-afternoon': { start: 12, end: 15 },
  'late-afternoon': { start: 15, end: 18 },
  'evening': { start: 18, end: 22 },
  'late-night': { start: 22, end: 26 }, // 26 = 2am next day
};

function getPlanTimeStatus(plan: Plan): 'past' | 'live' | 'upcoming' {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const planDate = new Date(plan.date);
  const planDay = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate());

  if (planDay > today) return 'upcoming';
  if (planDay < today) return 'past';

  // Same day — check time slot
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const slot = TIME_SLOT_HOURS[plan.timeSlot];
  if (!slot) return 'upcoming';

  // If plan has explicit start/end times, use those
  if (plan.startTime) {
    const [sh, sm] = plan.startTime.split(':').map(Number);
    const startH = sh + sm / 60;
    const endH = plan.endTime
      ? (() => { const [eh, em] = plan.endTime!.split(':').map(Number); return eh + em / 60; })()
      : startH + plan.duration / 60;
    if (currentHour < startH) return 'upcoming';
    if (currentHour >= startH && currentHour < endH) return 'live';
    return 'past';
  }

  if (currentHour < slot.start) return 'upcoming';
  if (currentHour >= slot.start && currentHour < slot.end) return 'live';
  return 'past';
}

function computeInitialOrder(plans: Plan[]): number[] {
  const statuses = plans.map((p, i) => ({ i, status: getPlanTimeStatus(p) }));
  // Priority: live first, then upcoming, then past
  const live = statuses.filter(s => s.status === 'live').map(s => s.i);
  const upcoming = statuses.filter(s => s.status === 'upcoming').map(s => s.i);
  const past = statuses.filter(s => s.status === 'past').map(s => s.i);
  return [...live, ...upcoming, ...past];
}

// Swipe-to-flip stacked cards — cycles top card to bottom
function SwipeStack({ plans, selectMode, selectedIds, onCardTap }: {
  plans: Plan[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onCardTap: (id: string) => void;
}) {
  // order[0] is front card, order[n-1] is back
  const [order, setOrder] = useState(() => computeInitialOrder(plans));
  const dragStartX = useRef(0);
  const dragDelta = useRef(0);
  const didSwipe = useRef(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  // Keep order in sync if plans change
  useEffect(() => {
    setOrder(computeInitialOrder(plans));
  }, [plans.length]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    dragDelta.current = 0;
    didSwipe.current = false;
    setSwiping(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swiping) return;
    dragDelta.current = e.clientX - dragStartX.current;
    if (Math.abs(dragDelta.current) > 8) didSwipe.current = true;
    setSwipeX(dragDelta.current);
  };

  const handlePointerUp = () => {
    if (!swiping) return;
    setSwiping(false);
    const threshold = 60;
    if (dragDelta.current < -threshold) {
      // Swipe left: send front card to back
      setOrder(prev => [...prev.slice(1), prev[0]]);
    } else if (dragDelta.current > threshold) {
      // Swipe right: bring last card to front
      setOrder(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    }
    setSwipeX(0);
    dragDelta.current = 0;
  };

  const handleCardTapIfNotSwiped = (planId: string) => {
    if (didSwipe.current) return;
    onCardTap(planId);
  };

  return (
    <div
      className="relative"
      style={{ height: '116px' }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      {order.map((planIdx, stackPos) => {
        const plan = plans[planIdx];
        if (!plan) return null;
        const isTop = stackPos === 0;
        const isVisible = stackPos <= 3;
        const timeStatus = getPlanTimeStatus(plan);
        const isPast = timeStatus === 'past';

        return (
          <motion.div
            key={plan.id}
            className={cn(
              "absolute top-0",
              !isVisible && "pointer-events-none",
              isPast && isTop && "opacity-60"
            )}
            initial={false}
            animate={{
              x: isTop ? swipeX * 0.4 : stackPos * 20,
              scale: isTop ? 1 : 1 - stackPos * 0.03,
              opacity: isTop ? (isPast ? 0.55 : 1) : !isVisible ? 0 : 1 - stackPos * 0.2,
              rotate: isTop ? swipeX * 0.06 : 0,
            }}
            transition={swiping && isTop ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
            style={{ zIndex: plans.length - stackPos, width: 'calc(100% - 40px)', left: 0 }}
            onPointerDown={isTop ? handlePointerDown : undefined}
            onPointerMove={isTop ? handlePointerMove : undefined}
            onPointerUp={isTop ? handlePointerUp : undefined}
            onPointerCancel={isTop ? handlePointerUp : undefined}
          >
            <PlanCardCompact
              plan={plan}
              selectMode={selectMode}
              selected={selectedIds.has(plan.id)}
              onTap={() => handleCardTapIfNotSwiped(plan.id)}
              onLongPress={() => onCardTap(plan.id)}
              isPast={isPast}
              isLive={timeStatus === 'live'}
            />
          </motion.div>
        );
      })}
      {/* Pagination dots */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {plans.map((plan, idx) => (
          <div
            key={idx}
            className={cn(
              "h-1.5 rounded-full transition-all",
              order[0] === idx ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
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
  const hasPendingChange = !!plan.pendingChange;
  const showTentativeStyle = isTentative || isPendingRsvp || hasPendingChange;

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
        "w-full min-h-[100px] rounded-xl border bg-card p-3 text-left transition-all active:scale-[0.99] shadow-lg ring-1 ring-white/5 flex flex-col",
        showTentativeStyle && "border-dashed border-muted-foreground/40 opacity-70",
        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-start gap-2 mb-1.5 min-w-0">
        {selectMode && (
          <Checkbox checked={selected} className="shrink-0 mt-0.5" />
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={16} />
        </div>
        <span className="flex-1 min-w-0 text-sm font-semibold leading-tight break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{displayTitle}</span>
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
              <span className="truncate">{plan.location.name.split(' · ')[0].split(', ')[0].split(' - ')[0]}</span>
            </div>
          )}
        </div>
        {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
          <div className="text-[10px] truncate">
            w/ {plan.participants.filter(p => p.role !== 'subscriber').map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {hasPendingChange && (
        <span className="mt-1.5 inline-block rounded-full bg-muted border border-muted-foreground/20 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          Proposed change
        </span>
      )}
      {isPendingRsvp && !hasPendingChange && (
        <span className="mt-1.5 inline-block rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          Pending RSVP
        </span>
      )}
    </button>
  );
}
