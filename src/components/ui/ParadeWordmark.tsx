import { cn } from '@/lib/utils';

interface ParadeWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ParadeWordmark({ className, size = 'md' }: ParadeWordmarkProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <span
      className={cn(
        'font-display font-bold parade-wordmark',
        sizeClasses[size],
        className
      )}
    >
      Parade
    </span>
  );
}
