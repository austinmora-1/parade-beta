import { cn } from '@/lib/utils';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'xl' }: ParadeWordmarkProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

  return (
    <span
      className={cn(
        'parade-wordmark tracking-wide text-primary leading-none',
        sizeClasses[size],
        className
      )}
    >
      parade
    </span>
  );
}
