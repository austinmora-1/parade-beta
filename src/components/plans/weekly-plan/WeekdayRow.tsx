import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Plan, DayAvailability, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import { getDayStatus } from './dayStatus';

interface Props {
  date: Date;
  plans: Plan[];
  isToday: boolean;
  availabilityMap: Record<string, DayAvailability>;
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>;
  onAddPlan: (date: Date) => void;
  notificationCount?: number;
}

/**
 * Compact weekday row used in the new Plans & Trips list view.
 * Mirrors the screenshot: small caps day name + big serif date on the
 * left, slot-coverage bar + plan title in the middle, chevron on the
 * right. Optional notification badge over the date.
 */
export function WeekdayRow({
  date,
  plans,
  isToday,
  availabilityMap,
  coverageByDate,
  onAddPlan,
  notificationCount = 0,
}: Props) {
  const navigate = useNavigate();
  const dayName = format(date, 'EEE').toUpperCase();
  const dayNum = format(date, 'd');

  const primary = plans[0];
  const extraCount = Math.max(0, plans.length - 1);
  const status = getDayStatus(date, coverageByDate, availabilityMap);
  const primaryIcon = primary
    ? ACTIVITY_CONFIG[primary.activity as keyof typeof ACTIVITY_CONFIG]?.icon
    : null;

  const handleClick = () => {
    navigate(`/day/${format(date, 'yyyy-MM-dd')}`);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group relative flex w-full items-stretch gap-3 overflow-hidden rounded-2xl border border-border bg-card pr-3 text-left shadow-soft transition-colors hover:bg-card/80',
        isToday && 'border-primary/30 ring-1 ring-primary/15',
      )}
    >
      {/* Color accent stripe */}
      <span className={cn('w-1 shrink-0', status.accentClass)} aria-hidden />

      {/* Date column */}
      <div className="relative flex w-10 shrink-0 flex-col items-center justify-center py-3">
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            isToday ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {dayName}
        </span>
        <span
          className={cn(
            'font-display text-3xl font-black leading-none',
            isToday ? 'text-primary' : 'text-foreground',
          )}
        >
          {dayNum}
        </span>
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
            {notificationCount}
          </span>
        )}
      </div>

      {/* Middle column: status + plan */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3">
        {primary ? (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              {primaryIcon && <span className="shrink-0 text-sm leading-none">{primaryIcon}</span>}
              <span className="truncate text-base font-semibold text-foreground">
                {primary.title || 'Plan'}
              </span>
              {extraCount > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  +{extraCount}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClass)} />
              {status.label}
            </span>
          </>
        ) : (
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
              status.chipClass,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dotClass)} />
            {status.label}
          </span>
        )}
      </div>

      <ChevronRight className="my-auto h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
