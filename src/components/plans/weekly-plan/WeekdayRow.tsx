import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Plan, DayAvailability, TimeSlot } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import { getDayStatus } from './dayStatus';
import { DayPlanDeck } from './DayPlanDeck';

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

  const extraCount = Math.max(0, plans.length - 3);
  const status = getDayStatus(date, coverageByDate, availabilityMap);

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

      {/* Middle column: status + stacked plan cards */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-3">
        {visiblePlans.length > 0 ? (
          <>
            <div className="flex flex-col gap-1">
              {visiblePlans.map((p, i) => {
                const cfg = ACTIVITY_CONFIG[p.activity as keyof typeof ACTIVITY_CONFIG];
                const accent = cfg?.color ? `hsl(var(--${cfg.color}))` : 'hsl(var(--primary))';
                return (
                  <div
                    key={p.id}
                    className="flex min-w-0 items-center rounded-md border border-border/60 bg-muted/40 px-2 py-1"
                    style={{
                      marginLeft: `${i * 4}px`,
                      borderLeft: `3px solid ${accent}`,
                    }}
                  >
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {p.title || 'Plan'}
                    </span>
                  </div>
                );
              })}
              {extraCount > 0 && (
                <span className="pl-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  +{extraCount} more
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
