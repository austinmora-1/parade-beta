import { useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { Send, Plane, Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIME_SLOT_LABELS, TimeSlot, ACTIVITY_CONFIG } from '@/types/planner';

export type SlotStatus = 'available' | 'busy' | 'plan';

export interface PillsPlan {
  id: string;
  title: string;
  activity: string;
  time_slot: string;
  date: string;
}

export interface PillsDayMeta {
  isAway?: boolean;
  trip_location?: string | null;
}

export interface AvailabilityPillsProps {
  days: Date[];
  /** Returns the slot's status for the share-target user */
  getSlotStatus: (date: Date, slot: TimeSlot) => SlotStatus;
  /** Whether the *viewer* is also free in that slot (drives "both free" highlight) */
  isMySlotFree?: (date: Date, slot: TimeSlot) => boolean;
  /** Plans for the target user — used to badge slot pills with activity */
  plans?: PillsPlan[];
  /** Per-day metadata (away, trip location) keyed by yyyy-MM-dd */
  dayMeta?: Record<string, PillsDayMeta>;
  /** Whether the viewer is signed in — controls "both free" semantics */
  signedIn?: boolean;
  onSlotClick: (day: Date, slot: TimeSlot) => void;
}

const SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

const SLOT_HOURS: Record<TimeSlot, number> = {
  'early-morning': 3,
  'late-morning': 3,
  'early-afternoon': 3,
  'late-afternoon': 3,
  'evening': 4,
  'late-night': 4,
};

interface OpenBlock {
  slots: TimeSlot[];
  hours: number;
  bothFreeHours: number;
}

function buildBlocks(
  date: Date,
  getStatus: (d: Date, s: TimeSlot) => SlotStatus,
  isMyFree?: (d: Date, s: TimeSlot) => boolean,
): OpenBlock[] {
  const out: OpenBlock[] = [];
  let cur: TimeSlot[] = [];
  let curBoth = 0;
  const flush = () => {
    if (!cur.length) return;
    const hours = cur.reduce((a, s) => a + SLOT_HOURS[s], 0);
    out.push({ slots: cur, hours, bothFreeHours: curBoth });
    cur = [];
    curBoth = 0;
  };
  for (const slot of SLOT_ORDER) {
    if (getStatus(date, slot) === 'available') {
      cur.push(slot);
      if (isMyFree && isMyFree(date, slot)) curBoth += SLOT_HOURS[slot];
    } else {
      flush();
    }
  }
  flush();
  return out;
}

function fmtHour(hr: number): string {
  const h24 = ((hr % 24) + 24) % 24;
  if (h24 === 0) return '12am';
  if (h24 < 12) return `${h24}am`;
  if (h24 === 12) return '12pm';
  return `${h24 - 12}pm`;
}

function slotBounds(slot: TimeSlot): { start: number; end: number } {
  switch (slot) {
    case 'early-morning': return { start: 6, end: 9 };
    case 'late-morning': return { start: 9, end: 12 };
    case 'early-afternoon': return { start: 12, end: 15 };
    case 'late-afternoon': return { start: 15, end: 18 };
    case 'evening': return { start: 18, end: 22 };
    case 'late-night': return { start: 22, end: 26 };
  }
}

function blockLabel(block: OpenBlock): string {
  const start = slotBounds(block.slots[0]).start;
  const end = slotBounds(block.slots[block.slots.length - 1]).end;
  return `${fmtHour(start)}–${fmtHour(end)}`;
}

export function AvailabilityPills({
  days,
  getSlotStatus,
  isMySlotFree,
  plans = [],
  dayMeta = {},
  signedIn = false,
  onSlotClick,
}: AvailabilityPillsProps) {
  const rows = useMemo(
    () =>
      days.map((day) => {
        const blocks = buildBlocks(day, getSlotStatus, isMySlotFree);
        return { day, blocks };
      }),
    [days, getSlotStatus, isMySlotFree],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-2">
      {rows.map(({ day, blocks }) => {
        const key = day.toISOString();
        const dateStr = format(day, 'yyyy-MM-dd');
        const meta = dayMeta[dateStr];
        const isPast = day < today;
        const isAway = meta?.isAway;
        const dayPlans = plans.filter((p) => isSameDay(new Date(p.date), day));

        return (
          <div
            key={key}
            className={cn(
              'rounded-xl border bg-card p-2.5 transition-colors',
              isPast && 'opacity-50',
              isToday(day) && !isAway && 'border-primary/40 bg-primary/5',
              isAway && 'border-availability-away/40 bg-availability-away/5',
              !isToday(day) && !isAway && 'border-border',
            )}
          >
            {/* Day header */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isAway
                      ? 'text-availability-away'
                      : isToday(day)
                      ? 'text-primary'
                      : 'text-foreground',
                  )}
                >
                  {format(day, 'EEE')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(day, 'MMM d')}
                </span>
                {isToday(day) && (
                  <span
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
                      isAway
                        ? 'bg-availability-away/10 text-availability-away'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    Today
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-[10px] shrink-0',
                  isAway
                    ? 'text-availability-away font-medium'
                    : 'text-muted-foreground',
                )}
              >
                {isAway ? (
                  <>
                    <Plane className="h-3 w-3 shrink-0" />
                    {meta?.trip_location && (
                      <span className="truncate max-w-[100px]">
                        {meta.trip_location}
                      </span>
                    )}
                  </>
                ) : (
                  <Home className="h-3 w-3 shrink-0" />
                )}
              </div>
            </div>

            {/* Open-window pills */}
            {blocks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic px-0.5 py-1">
                {isPast ? 'Past' : 'Nothing open'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {blocks.map((block, i) => {
                  const bothFree =
                    signedIn && block.bothFreeHours > 0;
                  // Find any plan that overlaps the first slot of this block — purely cosmetic
                  const planInBlock = dayPlans.find((p) =>
                    block.slots.includes(p.time_slot as TimeSlot),
                  );
                  return (
                    <button
                      key={i}
                      disabled={isPast}
                      onClick={() => !isPast && onSlotClick(day, block.slots[0])}
                      className={cn(
                        'group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all',
                        bothFree &&
                          'bg-availability-available/30 text-foreground ring-1 ring-availability-available/40 hover:bg-availability-available/40',
                        !bothFree &&
                          'bg-availability-available/15 text-foreground hover:bg-availability-available/25',
                        isPast && 'cursor-not-allowed',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          bothFree
                            ? 'bg-availability-available'
                            : 'bg-availability-available/60',
                        )}
                      />
                      <span>{blockLabel(block)}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {block.hours}hr
                      </span>
                      {planInBlock && (
                        <span className="text-[10px]">
                          {ACTIVITY_CONFIG[
                            planInBlock.activity as keyof typeof ACTIVITY_CONFIG
                          ]?.icon || '📅'}
                        </span>
                      )}
                      {!isPast && (
                        <Send className="h-2.5 w-2.5 text-availability-available/70 group-hover:text-availability-available transition-colors" />
                      )}
                    </button>
                  );
                })}
                {/* Show busy / plan slots as a quieter trailing chip strip for context */}
                {SLOT_ORDER.some(
                  (s) => getSlotStatus(day, s) !== 'available',
                ) && (
                  <span className="inline-flex items-center text-[10px] text-muted-foreground/70">
                    <ChevronRight className="h-2.5 w-2.5" />
                    {SLOT_ORDER.filter(
                      (s) => getSlotStatus(day, s) === 'plan',
                    ).length}{' '}
                    booked
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Re-export for convenience
export { TIME_SLOT_LABELS };
