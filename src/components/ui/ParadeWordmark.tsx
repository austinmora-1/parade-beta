import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'md' }: ParadeWordmarkProps) {
  const { theme, resolvedTheme } = useTheme();
  const isArcade = theme === 'arcade';
  const isLight = resolvedTheme === 'light';

  const sizeClasses = {
    sm: isArcade ? 'text-sm' : 'text-xl',
    md: isArcade ? 'text-base' : 'text-2xl',
    lg: isArcade ? 'text-lg' : 'text-3xl',
    xl: isArcade ? 'text-2xl' : 'text-5xl',
  };

  if (isArcade) {
    return (
      <span
        className={cn(
          'arcade-wordmark tracking-wide inline-flex items-end',
          sizeClasses[size],
          className
        )}
      >
        <span className="arcade-letter-broken" aria-hidden="true">P</span>
        <span>A</span>
        <span>R</span>
        <span className="arcade-caret-insert">
          <span className="arcade-caret-letter">C</span>
          <span className="arcade-caret-symbol">^</span>
        </span>
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
      style={isLight ? { color: 'hsl(150 35% 40%)' } : undefined}
    >
      parade
    </span>
  );
}
