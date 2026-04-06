import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { UpcomingPlans } from './UpcomingPlans';
import { FeedView } from '@/components/feed/FeedView';

const TABS = ['Upcoming Plans', 'Your Feed'] as const;

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && activeTab < TABS.length - 1) setActiveTab(prev => prev + 1);
      if (dx > 0 && activeTab > 0) setActiveTab(prev => prev - 1);
    }
  }, [activeTab]);

  return (
    <div>
      {/* Tab pills with animated indicator */}
      <div className="relative flex gap-0.5 rounded-xl bg-muted/60 p-1 self-start mb-4 w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              "relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors z-10",
              activeTab === i
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeTab === i && (
              <motion.div
                layoutId="home-tab-pill"
                className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      {/* Content with crossfade */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 0 ? -12 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === 0 ? 12 : -12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 0 ? (
              <UpcomingPlans standalone />
            ) : (
              <FeedView />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
