import { ReactNode } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';

interface SwipeableDismissProps {
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
}

const SWIPE_THRESHOLD = 100;

export function SwipeableDismiss({ children, onDismiss, className }: SwipeableDismissProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-SWIPE_THRESHOLD * 1.5, 0, SWIPE_THRESHOLD * 1.5], [0.3, 1, 0.3]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
      onDismiss();
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={handleDragEnd}
      style={{ x, opacity }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
