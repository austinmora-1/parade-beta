import { format } from 'date-fns';
import { TimeSlot, DayAvailability } from '@/types/planner';
import { SlotCoverage } from '@/lib/planSlotCoverage';

const SLOTS: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

export type DayStatus = 'open' | 'mostly-open' | 'some' | 'busy' | 'unavailable';

export interface DayStatusInfo {
  status: DayStatus;
  label: string;
  /** Tailwind background class for a dot/pill swatch */
  dotClass: string;
  /** Tailwind classes for a soft pill chip */
  chipClass: string;
  /** Tailwind class for a left-edge accent stripe */
  accentClass: string;
  freeCount: number;
  busyCount: number;
}

export function getDayStatus(
  date: Date,
  coverageByDate: Map<string, Map<TimeSlot, SlotCoverage>>,
  availabilityMap: Record<string, DayAvailability>,
): DayStatusInfo {
  const key = format(date, 'yyyy-MM-dd');
  const dayAvail = availabilityMap[key];
  const dayCov = coverageByDate.get(key);

  let free = 0;
  let busy = 0;
  for (const slot of SLOTS) {
    const cov = dayCov?.get(slot);
    const userMarkedFree = !dayAvail || !!dayAvail.slots[slot];
    if (cov?.kind === 'busy') busy++;
    else if (!userMarkedFree) busy++;
    else free++;
  }

  let status: DayStatus;
  if (free === 0) status = 'unavailable';
  else if (busy === 0) status = 'open';
  else if (busy >= 4) status = 'busy';
  else if (busy <= 1) status = 'mostly-open';
  else status = 'some';

  const map: Record<DayStatus, Omit<DayStatusInfo, 'freeCount' | 'busyCount' | 'status'>> = {
    open: {
      label: 'Open',
      dotClass: 'bg-availability-available',
      chipClass: 'bg-availability-available/15 text-availability-available',
      accentClass: 'bg-availability-available',
    },
    'mostly-open': {
      label: 'Mostly Open',
      dotClass: 'bg-availability-available',
      chipClass: 'bg-availability-available/15 text-availability-available',
      accentClass: 'bg-availability-available',
    },
    some: {
      label: 'Some time',
      dotClass: 'bg-availability-partial',
      chipClass: 'bg-availability-partial/15 text-availability-partial',
      accentClass: 'bg-availability-partial',
    },
    busy: {
      label: 'Booked',
      dotClass: 'bg-primary',
      chipClass: 'bg-primary/15 text-primary',
      accentClass: 'bg-primary',
    },
    unavailable: {
      label: 'Unavailable',
      dotClass: 'bg-muted-foreground/40',
      chipClass: 'bg-muted text-muted-foreground',
      accentClass: 'bg-muted-foreground/30',
    },
  };

  return { status, freeCount: free, busyCount: busy, ...map[status] };
}
