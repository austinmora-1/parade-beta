import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { getCompactPlanTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { formatTime12 } from './planCardHelpers';

interface Props {
  plans: Plan[];
}

/**
 * Compact deck-of-cards stack of plans for a day, swipeable.
 * Designed to sit on the right side of a WeekdayRow.
 */
export function DayPlanDeck({ plans }: Props) {
  const navigate = useNavigate();
  const [order, setOrder] = useState<number[]>(() => plans.map((_, i) => i));
  const dragStartX = useRef(0);
  const dragDelta = useRef(0);
  const didSwipe = useRef(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    setOrder(plans.map((_, i) => i));
  }, [plans.length]);

  if (plans.length === 0) return null;

  const handleDown = (e: React.PointerEvent) => {
    if (plans.length < 2) return;
    dragStartX.current = e.clientX;
    dragDelta.current = 0;
    didSwipe.current = false;
    setSwiping(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleMove = (e: React.PointerEvent) => {
    if (!swiping) return;
    dragDelta.current = e.clientX - dragStartX.current;
    if (Math.abs(dragDelta.current) > 6) didSwipe.current = true;
    setSwipeX(dragDelta.current);
  };
  const handleUp = (e: React.PointerEvent, planId: string) => {
    e.stopPropagation();
    if (!swiping) {
      if (!didSwipe.current) navigate(`/plan/${planId}`);
      return;
    }
    setSwiping(false);
    const threshold = 40;
    if (dragDelta.current < -threshold) {
      setOrder((prev) => [...prev.slice(1), prev[0]]);
    } else if (dragDelta.current > threshold) {
      setOrder((prev) => [prev[prev.length - 1], ...prev.slice(0, -1)]);
    } else if (!didSwipe.current) {
      navigate(`/plan/${planId}`);
    }
    setSwipeX(0);
    dragDelta.current = 0;
  };

  return (
    <div
      className="relative h-[64px] w-[150px] shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {order.map((planIdx, stackPos) => {
        const plan = plans[planIdx];
        if (!plan || stackPos > 2) return null;
        const isTop = stackPos === 0;
        const cfg = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG] ?? {
          label: 'Activity',
          icon: '✨',
          color: 'activity-misc',
          category: 'staying-in' as const,
        };
        const slotCfg = TIME_SLOT_LABELS[plan.timeSlot];
        const timeLabel = plan.startTime
          ? formatTime12(plan.startTime)
          : (typeof slotCfg === 'string' ? slotCfg : slotCfg?.time ?? '');

        return (
          <motion.div
            key={plan.id}
            initial={false}
            animate={{
              x: isTop ? swipeX * 0.6 : stackPos * 6,
              y: stackPos * 3,
              scale: 1 - stackPos * 0.04,
              rotate: isTop ? swipeX * 0.05 : 0,
              opacity: stackPos === 0 ? 1 : 0.85 - stackPos * 0.15,
            }}
            transition={swiping && isTop ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
            style={{ zIndex: 10 - stackPos }}
            className="absolute inset-0"
            onPointerDown={isTop ? handleDown : undefined}
            onPointerMove={isTop ? handleMove : undefined}
            onPointerUp={isTop ? (e) => handleUp(e, plan.id) : undefined}
            onPointerCancel={isTop ? (e) => handleUp(e, plan.id) : undefined}
          >
            <div
              className={cn(
                'flex h-full w-full flex-col justify-between rounded-lg border bg-card p-2 shadow-md',
                plan.status === 'tentative'
                  ? 'border-dashed border-muted-foreground/40'
                  : 'border-border',
              )}
              style={{ borderLeft: `3px solid hsl(var(--${cfg.color}))` }}
            >
              <div className="flex items-start gap-1.5 min-w-0">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `hsl(var(--${cfg.color}) / 0.15)` }}
                >
                  <ActivityIcon config={cfg} size={11} />
                </div>
                <span className="truncate text-[12px] font-semibold leading-tight text-foreground">
                  {getCompactPlanTitle(plan, 18)}
                </span>
              </div>
              <span className="truncate text-[10px] font-medium text-muted-foreground">
                {timeLabel}
              </span>
            </div>
          </motion.div>
        );
      })}
      {plans.length > 1 && (
        <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5">
          {plans.slice(0, 5).map((_, idx) => (
            <span
              key={idx}
              className={cn(
                'h-1 rounded-full transition-all',
                order[0] === idx ? 'w-2.5 bg-primary' : 'w-1 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
