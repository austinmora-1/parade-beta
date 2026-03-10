import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

interface CollapsibleWidgetProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  headerRight?: ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsibleWidget({
  title,
  icon,
  badge,
  headerRight,
  defaultOpen = true,
  compact = false,
  children,
  className,
}: CollapsibleWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { theme } = useTheme();
  const isArcade = theme === 'arcade';

  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-soft", isArcade && "rounded-md", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between text-left",
          isArcade
            ? "px-3 py-1.5 min-h-[32px]"
            : compact
              ? "px-3 py-2 min-h-[36px]"
              : "px-4 py-3 md:px-5 md:py-3.5 min-h-[44px] md:min-h-[48px]"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h3 className={cn("font-display font-semibold", isArcade ? "text-[10px]" : compact ? "text-sm" : "text-base")}>{title}</h3>
          {badge}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 md:px-5 md:pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
