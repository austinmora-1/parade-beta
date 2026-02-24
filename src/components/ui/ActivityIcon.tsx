import { cn } from '@/lib/utils';
import type { ActivityConfig } from '@/types/planner';

interface ActivityIconProps {
  config: ActivityConfig;
  className?: string;
  size?: number;
}

export function ActivityIcon({ config, className, size = 16 }: ActivityIconProps) {
  if (config.lucideIcon) {
    const Icon = config.lucideIcon;
    return <Icon className={cn("shrink-0", className)} size={size} />;
  }
  return <span className={className}>{config.icon}</span>;
}
