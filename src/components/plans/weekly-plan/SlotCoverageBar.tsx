import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { TimeSlot, DayAvailability } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

type Status = 'available' | 'partial' | 'busy' | 'unavailable';

interface Props {
  date: Date;
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>;
  availabilityMap: Record<string, DayAvailability>;
  className?: string;
  segmentClassName?: string;
}

/**
 * Reusable 6-segment availability bar (one per fixed time slot).
 * Mirrors the dashboard WeekOverview status logic so visuals stay in sync.
 */
export function SlotCoverageBar({ date, coverageByDate, availabilityMap, className, segmentClassName }: Props) {
  const key = format(date, 'yyyy-MM-dd');
  const dayAvail = availabilityMap[key];
  const dayCov = coverageByDate.get(key);

  const getStatus = (slot: TimeSlot): Status => {
    const cov = dayCov?.get(slot);
    if (cov?.kind === 'busy') return 'busy';
    const userMarkedFree = !dayAvail || !!dayAvail.slots[slot];
    if (cov?.kind === 'partial') return userMarkedFree ? 'partial' : 'unavailable';
    if (!userMarkedFree) return 'unavailable';
    return 'available';
  };

  return (
    <div className={cn('flex gap-0.5 w-full', className)}>
      {TIME_SLOT_ORDER.map((slot) => {
        const status = getStatus(slot);
        return (
          <div
            key={slot}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              status === 'available' && 'bg-availability-available/70',
              status === 'partial' && 'bg-availability-partial-stripes',
              status === 'busy' && 'bg-primary/70',
              status === 'unavailable' && 'bg-muted-foreground/20',
              segmentClassName,
            )}
          />
        );
      })}
    </div>
  );
}
