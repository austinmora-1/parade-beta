import { cn } from '@/lib/utils';
import { DayStatus } from './dayStatus';

interface Props {
  dayName: string;
  dayNum: string;
  status: DayStatus;
  /** Fraction of the ring to fill, 0–1. */
  fill: number;
  isToday?: boolean;
  size?: number;
}

/**
 * Circular date "dial" with an arc indicating availability.
 * - open       → full green ring
 * - some       → ~half amber arc
 * - busy       → small coral arc
 * - unavailable → muted dotted ring
 */
export function DateDial({ dayName, dayNum, status, fill, isToday, size = 56 }: Props) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, fill)) * c;

  const colorVar =
    status === 'open'
      ? 'hsl(var(--availability-available))'
      : status === 'some'
      ? 'hsl(var(--availability-partial))'
      : status === 'busy'
      ? 'hsl(var(--secondary))'
      : 'hsl(var(--muted-foreground) / 0.35)';

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.18)"
          strokeWidth={stroke}
          strokeDasharray={status === 'unavailable' ? '2 4' : undefined}
        />
        {/* Arc */}
        {status !== 'unavailable' && fill > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colorVar}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            'font-display text-[9px] font-bold uppercase tracking-wider leading-none',
            isToday ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {dayName}
        </span>
        <span
          className={cn(
            'font-display text-xl font-black leading-none mt-0.5',
            status === 'busy' && 'text-secondary',
            status === 'some' && 'text-availability-partial',
            status === 'open' && 'text-foreground',
            status === 'unavailable' && 'text-muted-foreground',
          )}
        >
          {dayNum}
        </span>
      </div>
    </div>
  );
}
