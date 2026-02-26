import { useState, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const THRESHOLD = 110;
const MIN_PULL_BEFORE_TRACKING = 20;

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(15);
  }
}

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const hasTriggeredHaptic = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
      hasTriggeredHaptic.current = false;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const rawDiff = currentY - startY.current;

    // Only start showing pull indicator after user has pulled past a dead zone
    if (rawDiff < MIN_PULL_BEFORE_TRACKING) {
      setPullDistance(0);
      return;
    }

    const effectiveDiff = rawDiff - MIN_PULL_BEFORE_TRACKING;
    const dampened = Math.min(effectiveDiff * 0.35, 130);
    setPullDistance(dampened);

    // Haptic bump when crossing the threshold
    if (dampened >= THRESHOLD && !hasTriggeredHaptic.current) {
      hasTriggeredHaptic.current = true;
      triggerHaptic();
    } else if (dampened < THRESHOLD) {
      hasTriggeredHaptic.current = false;
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || refreshing) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      triggerHaptic();
      setPullDistance(50);
      await controls.start({
        rotate: 720,
        transition: { duration: 0.8, ease: 'easeInOut' },
      });
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }, [pulling, refreshing, pullDistance, controls]);

  if (!isMobile) return <>{children}</>;

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance }}
      >
        <motion.div
          animate={controls}
          style={{ opacity: progress, scale: progress }}
          className="flex items-center justify-center"
        >
          <RefreshCw
            className={`h-6 w-6 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
        </motion.div>
      </div>
      {children}
    </div>
  );
}
