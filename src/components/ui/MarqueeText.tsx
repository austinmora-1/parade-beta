import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeTextProps {
  text: string;
  className?: string;
}

export function MarqueeText({ text, className }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const [scrollDuration, setScrollDuration] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const check = () => {
      const overflow = textEl.scrollWidth > container.clientWidth + 1;
      setIsOverflowing(overflow);
      if (overflow) {
        const px = textEl.scrollWidth - container.clientWidth;
        setOverflowPx(px);
        setScrollDuration(Math.max(2, px / 40));
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  const startCycle = useCallback(() => {
    if (!isOverflowing) return;
    setIsAnimating(true);
  }, [isOverflowing]);

  // Start first cycle after mount + a short delay
  useEffect(() => {
    if (!isOverflowing) return;
    timerRef.current = setTimeout(() => startCycle(), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOverflowing, startCycle]);

  const handleAnimationEnd = () => {
    setIsAnimating(false);
    // Wait 10 seconds then run again
    timerRef.current = setTimeout(() => {
      setIsAnimating(true);
    }, 10000);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap", className)}
    >
      <span
        ref={textRef}
        className="inline-block"
        style={
          isAnimating
            ? {
                animation: `marquee-once ${scrollDuration}s ease-in-out forwards`,
                '--marquee-distance': `-${overflowPx}px`,
              } as React.CSSProperties
            : { transform: 'translateX(0)' }
        }
        onAnimationEnd={handleAnimationEnd}
      >
        {text}
      </span>
    </div>
  );
}
