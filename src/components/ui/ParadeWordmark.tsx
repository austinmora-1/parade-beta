import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'md' }: ParadeWordmarkProps) {
  const { theme } = useTheme();
  const isArcade = theme === 'arcade';

  const sizeClasses = {
    sm: isArcade ? 'text-sm' : 'text-xl',
    md: isArcade ? 'text-base' : 'text-2xl',
    lg: isArcade ? 'text-lg' : 'text-3xl',
    xl: isArcade ? 'text-2xl' : 'text-5xl',
  };

  return (
    <span
      className={cn(
        isArcade ? 'arcade-wordmark' : 'parade-wordmark',
        'tracking-wide',
        sizeClasses[size],
        className
      )}
    >
      parade
    </span>
  );
}
