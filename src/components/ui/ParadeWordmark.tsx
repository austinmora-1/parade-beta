import { cn } from '@/lib/utils';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'md' }: ParadeWordmarkProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
    xl: 'text-6xl',
  };

  return (
    <span
      className={cn(
        'font-semibold parade-wordmark tracking-tight',
        sizeClasses[size],
        className
      )}
    >
      parade
    </span>
  );
}
