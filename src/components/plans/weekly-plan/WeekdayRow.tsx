import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Plan, DayAvailability, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import { getDayStatus } from './dayStatus';
import { DateDial } from './DateDial';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { getCompactPlanTitle } from '@/lib/planTitle';
import { formatTime12, TIME_SLOT_HOURS } from './planCardHelpers';

interface Props {
  date: Date;
  plans: Plan[];
  isToday: boolean;
  availabilityMap: Record<string, DayAvailability>;
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>;
  onAddPlan: (date: Date) => void;
  notificationCount?: number;
}

const SLOTS: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

function planTimeLabel(p: Plan): string {
  if (p.startTime) return formatTime12(p.startTime);
  const hour = TIME_SLOT_HOURS[p.timeSlot]?.start;
  if (hour == null) return '';
  return formatTime12(`${String(hour % 24).padStart(2, '0')}:00`);
}

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
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  const status = getDayStatus(date, coverageByDate, availabilityMap);
  // Dial represents % of day that is unbooked (free slots / total slots)
  const totalSlots = status.freeCount + status.busyCount || SLOTS.length;
  const fill = status.status === 'unavailable'
    ? 0
    : status.freeCount / totalSlots;

  const slotOrder: Record<TimeSlot, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return slotOrder[a.timeSlot] - slotOrder[b.timeSlot];
  });
  const visiblePlans = sortedPlans.slice(0, 2);
  const extraCount = Math.max(0, sortedPlans.length - visiblePlans.length);

  const summaryLabel =
    status.status === 'busy' ? 'Booked' :
    status.status === 'some' ? 'Some time' :
    status.status === 'mostly-open' ? 'Mostly Open' :
    status.status === 'open' ? 'Open' : 'Unavailable';
  const summaryPillClass =
    status.status === 'busy' ? 'bg-secondary/15 text-secondary' :
    status.status === 'some' ? 'bg-amber-200/60 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' :
    status.status === 'mostly-open' ? 'bg-availability-available/10 text-[hsl(152_35%_42%)] dark:text-[hsl(152_45%_70%)]' :
    status.status === 'open' ? 'bg-availability-available/25 text-[hsl(152_55%_22%)] dark:text-[hsl(152_50%_55%)]' :
    'bg-muted text-muted-foreground';

  const planCountLabel = `${plans.length} plan${plans.length === 1 ? '' : 's'}`;

  const handleClick = () => {
    navigate(`/day/${format(date, 'yyyy-MM-dd')}`);
  };

  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-3 text-left shadow-soft transition-colors hover:bg-card/80',
        isToday && 'ring-1 ring-primary/20 border-2 border-primary',
        isWeekend && !isToday && 'border border-secondary/30 bg-gradient-to-br from-secondary/10 via-card to-primary/5 overflow-hidden',
      )}
    >
      {isWeekend && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-secondary/20 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-4 h-16 w-16 rounded-full bg-primary/15 blur-2xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 top-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-secondary/70"
          >
            ✦ {dow === 6 ? 'Sat' : 'Sun'}
          </span>
        </>
      )}
      {/* Date dial */}
      <button
        onClick={handleClick}
        className="relative shrink-0"
        aria-label={`Open ${format(date, 'EEEE, MMMM d')}`}
      >
        <DateDial
          dayName={dayName}
          dayNum={dayNum}
          status={status.status}
          fill={fill}
          isToday={isToday}
        />
        {notificationCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
            {notificationCount}
          </span>
        )}
      </button>

      {/* Middle: status + plan summary list */}
      <button
        onClick={handleClick}
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-left"
      >
        <div className="flex items-baseline gap-1.5">
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', summaryPillClass)}>
            {summaryLabel}
          </span>
          <span className="text-xs text-muted-foreground">· {planCountLabel}</span>
        </div>

        {visiblePlans.length === 0 ? (
          <span className="text-sm italic text-muted-foreground/70">Nothing yet</span>
        ) : (
          <ul className="space-y-0.5">
            {visiblePlans.map((p) => {
              const cfg = ACTIVITY_CONFIG[p.activity as keyof typeof ACTIVITY_CONFIG];
              return (
                <li key={p.id} className="flex items-center gap-1.5 min-w-0">
                  {cfg && (
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `hsl(var(--${cfg.color}) / 0.15)` }}
                    >
                      <ActivityIcon config={cfg} size={10} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                    {getCompactPlanTitle(p, 14)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {extraCount > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            +{extraCount} more
          </span>
        )}
      </button>

      {/* Right column: stacked times aligned to FAB */}
      {visiblePlans.length > 0 && (
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 self-stretch pt-[26px]">
          {visiblePlans.map((p) => (
            <span
              key={p.id}
              className="text-right text-[11px] font-medium leading-[18px] text-muted-foreground tabular-nums"
            >
              {planTimeLabel(p)}
            </span>
          ))}
        </div>
      )}

      {/* Add FAB */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddPlan(date); }}
        aria-label="Add plan"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-105 active:scale-95"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
