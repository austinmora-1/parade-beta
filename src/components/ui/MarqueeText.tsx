import { useRef, useEffect, useState } from 'react';
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
  const [duration, setDuration] = useState(5);

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
        // Total cycle ~10s: pause at start, scroll, pause at end, scroll back
        setDuration(Math.max(6, 10 + px / 40));
      }
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap", className)}
    >
      <span
        ref={textRef}
        className={cn("inline-block", isOverflowing && "animate-marquee")}
        style={
          isOverflowing
            ? {
                '--marquee-distance': `-${overflowPx}px`,
                '--marquee-duration': `${duration}s`,
              } as React.CSSProperties
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
