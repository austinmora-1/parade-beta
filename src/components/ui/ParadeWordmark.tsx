import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'md' }: ParadeWordmarkProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

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
