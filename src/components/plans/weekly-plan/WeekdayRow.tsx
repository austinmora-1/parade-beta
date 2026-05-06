import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Plan, DayAvailability, TimeSlot, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';
import { getDayStatus } from './dayStatus';
import { DateDial } from './DateDial';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { getCompactPlanTitle } from '@/lib/planTitle';
import { formatTime12 } from './planCardHelpers';

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
  if (p.startTime && p.endTime) {
    return `${formatTime12(p.startTime)}–${formatTime12(p.endTime)}`.replace(/(am|pm)–/, '–');
  }
  if (p.startTime) return formatTime12(p.startTime);
  const slot = TIME_SLOT_LABELS[p.timeSlot];
  return typeof slot === 'string' ? slot : slot?.time ?? '';
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

  const status = getDayStatus(date, coverageByDate, availabilityMap);
  // Dial represents % of day that is unbooked (free slots / total slots)
  const totalSlots = status.freeCount + status.busyCount || SLOTS.length;
  const fill = status.status === 'unavailable'
    ? 0
    : status.freeCount / totalSlots;

  const visiblePlans = plans.slice(0, 2);
  const extraCount = Math.max(0, plans.length - visiblePlans.length);

  const summaryLabel =
    status.status === 'busy' ? 'Booked' :
    status.status === 'some' ? 'Some time' :
    status.status === 'open' ? 'Open' : 'Unavailable';
  const summaryPillClass =
    status.status === 'busy' ? 'bg-secondary/15 text-secondary' :
    status.status === 'some' ? 'bg-availability-partial/15 text-availability-partial' :
    status.status === 'open' ? 'bg-availability-available/15 text-availability-available' :
    'bg-muted text-muted-foreground';

  const planCountLabel = `${plans.length} plan${plans.length === 1 ? '' : 's'}`;

  const handleClick = () => {
    navigate(`/day/${format(date, 'yyyy-MM-dd')}`);
  };

  return (
    <div
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-soft transition-colors hover:bg-card/80',
        isToday && 'border-primary/30 ring-1 ring-primary/15',
      )}
    >
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
          <span className={cn('text-sm font-bold', summaryColor)}>
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
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    {getCompactPlanTitle(p, 22)}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] font-medium text-muted-foreground">
                    {planTimeLabel(p)}
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
