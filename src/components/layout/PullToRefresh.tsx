import { useState, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

const THRESHOLD = 110;
const MIN_PULL_BEFORE_TRACKING = 20;

function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(15);
  }
}

function ElephantIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Body */}
      <ellipse cx="32" cy="34" rx="16" ry="13" fill="currentColor" opacity="0.85" />
      {/* Head */}
      <circle cx="20" cy="26" r="10" fill="currentColor" />
      {/* Ear */}
      <ellipse cx="12" cy="24" rx="6" ry="8" fill="currentColor" opacity="0.65" />
      {/* Inner ear */}
      <ellipse cx="12" cy="24" rx="3.5" ry="5" fill="hsl(var(--primary-foreground))" opacity="0.3" />
      {/* Eye */}
      <circle cx="18" cy="24" r="2" fill="hsl(var(--primary-foreground))" />
      <circle cx="18.5" cy="23.5" r="0.8" fill="currentColor" />
      {/* Trunk */}
      <path
        d="M14 30 Q10 36, 8 42 Q7 45, 10 44 Q12 43, 13 40 Q14 37, 16 34"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tusk */}
      <path
        d="M16 32 Q14 35, 16 36"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      {/* Legs */}
      <rect x="22" y="43" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="30" y="43" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="38" y="43" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="42" y="42" width="4" height="7" rx="2" fill="currentColor" opacity="0.7" />
      {/* Tail */}
      <path
        d="M48 32 Q54 30, 55 26 Q56 24, 54 25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Tail tuft */}
      <circle cx="54" cy="25" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
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

    if (rawDiff < MIN_PULL_BEFORE_TRACKING) {
      setPullDistance(0);
      return;
    }

    const effectiveDiff = rawDiff - MIN_PULL_BEFORE_TRACKING;
    const dampened = Math.min(effectiveDiff * 0.35, 130);
    setPullDistance(dampened);

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
        y: [0, -8, 0, -5, 0, -3, 0],
        transition: { duration: 0.8, ease: 'easeInOut' },
      });
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }, [pulling, refreshing, pullDistance, controls]);

  if (!isMobile) return <>{children}</>;

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const isReady = progress >= 1;

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
        className="flex flex-col items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance }}
      >
        <motion.div
          animate={controls}
          style={{ opacity: progress, scale: 0.6 + progress * 0.4 }}
          className="flex flex-col items-center gap-1"
        >
          <motion.div
            animate={
              refreshing
                ? { y: [0, -6, 0], rotate: [0, -3, 0, 3, 0] }
                : { rotate: pulling && isReady ? [0, -5, 5, 0] : 0 }
            }
            transition={
              refreshing
                ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.4, repeat: isReady ? Infinity : 0 }
            }
          >
            <ElephantIcon
              className="h-10 w-10 text-primary"
              style={{
                transform: refreshing ? undefined : `translateY(${(1 - progress) * 4}px)`,
              }}
            />
          </motion.div>
          {pullDistance > 20 && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {refreshing ? 'Refreshing…' : isReady ? 'Release!' : 'Pull down…'}
            </span>
          )}
        </motion.div>
      </div>
      {children}
    </div>
  );
}
