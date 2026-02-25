import { useState, useRef, useCallback } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const THRESHOLD = 80;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    // Dampen the pull
    const dampened = Math.min(diff * 0.4, 120);
    setPullDistance(dampened);
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || refreshing) return;
    setPulling(false);

    if (pullDistance >= THRESHOLD * 0.4) {
      setRefreshing(true);
      setPullDistance(50);
      await controls.start({
        rotate: 720,
        transition: { duration: 0.8, ease: 'easeInOut' },
      });
      // Reload the current page data
      window.location.reload();
    } else {
      setPullDistance(0);
    }
  }, [pulling, refreshing, pullDistance, controls]);

  if (!isMobile) return <>{children}</>;

  const progress = Math.min(pullDistance / (THRESHOLD * 0.4), 1);

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
