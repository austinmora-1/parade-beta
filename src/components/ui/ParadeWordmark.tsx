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

  if (isArcade) {
    // Renders "ARCADE" — the P flickers as broken/unlit, C is inserted
    // Letters: (p-broken) A R C A D E
    // Visual: the P is nearly invisible/flickering, so you read "ARCADE"
    return (
      <span
        className={cn(
          'arcade-wordmark tracking-wide inline-flex',
          sizeClasses[size],
          className
        )}
      >
        <span className="arcade-letter-broken" aria-hidden="true">P</span>
        <span>A</span>
        <span>R</span>
        <span className="arcade-letter-inserted">C</span>
        <span>A</span>
        <span>D</span>
        <span>E</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'parade-wordmark tracking-wide',
        sizeClasses[size],
        className
      )}
    >
      parade
    </span>
  );
}
