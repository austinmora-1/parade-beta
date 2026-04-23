import { useState, useEffect, useRef } from 'react';
import { Plan } from '@/types/planner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { PlanCardCompact } from './PlanCardCompact';
import { getPlanTimeStatus, computeInitialOrder } from './planCardHelpers';

interface SwipeStackProps {
  plans: Plan[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onCardTap: (id: string) => void;
}

export function SwipeStack({ plans, selectMode, selectedIds, onCardTap }: SwipeStackProps) {
  const [order, setOrder] = useState(() => computeInitialOrder(plans));
  const dragStartX = useRef(0);
  const dragDelta = useRef(0);
  const didSwipe = useRef(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);

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
      setOrder(prev => [...prev.slice(1), prev[0]]);
    } else if (dragDelta.current > threshold) {
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
              isPast && isTop && ""
            )}
            initial={false}
            animate={{
              x: isTop ? swipeX * 0.4 : stackPos * 20,
              scale: isTop ? 1 : 1 - stackPos * 0.03,
              opacity: isTop || selectedIds.has(plan.id) ? 1 : !isVisible ? 0 : 1 - stackPos * 0.2,
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
