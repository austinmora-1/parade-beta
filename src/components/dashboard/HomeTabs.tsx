import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UpcomingPlans } from './UpcomingPlans';
import { FeedView } from '@/components/feed/FeedView';

const TABS = ['Upcoming', 'Feed'] as const;

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
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
      {/* Tab pills */}
      <div className="flex gap-1 rounded-lg border border-border p-0.5 self-start mb-4 w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              activeTab === i
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 0 ? (
          <UpcomingPlans standalone />
        ) : (
          <FeedView />
        )}
      </div>
    </div>
  );
}
