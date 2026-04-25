import { useState, useMemo, useEffect } from 'react';
import {
  format, addDays, isSameDay, isToday, isTomorrow,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, addMonths, subMonths, isBefore, startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { TimeSlot } from '@/types/planner';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

const TIME_SLOTS: { label: string; value: TimeSlot; shortLabel: string }[] = [
  { label: 'Morning',    value: 'late-morning',     shortLabel: 'Morn' },
  { label: 'Lunch',      value: 'early-afternoon',  shortLabel: 'Lunch' },
  { label: 'Afternoon',  value: 'late-afternoon',   shortLabel: 'Aft' },
  { label: 'Evening',    value: 'evening',           shortLabel: 'Eve' },
  { label: 'Late Night', value: 'late-night',        shortLabel: 'Late' },
];

export interface SelectedSlotEntry {
  date: Date;
  slot: TimeSlot;
}

type SlotStatus = 'all-free' | 'some-free' | 'none-free' | null;

interface SlotCalendarPickerProps {
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
  onSelect: (date: Date, slot: TimeSlot) => void;
  /** For each date-slot combo, return availability status or null */
  getSlotStatus?: (date: Date, slot: TimeSlot) => SlotStatus;
  /** Number of days to show ahead (for "max date") */
  days?: number;
  hasFriends?: boolean;
  /** Multi-select mode */
  multiSelect?: boolean;
  /** Currently selected slots in multi-select mode */
  selectedSlots?: SelectedSlotEntry[];
  /** Callback for multi-select toggle */
  onToggleSlot?: (date: Date, slot: TimeSlot) => void;
  /** Initial month to focus when opening (e.g. the suggested date) */
  initialMonth?: Date | null;
}

function isSlotSelected(entries: SelectedSlotEntry[], date: Date, slot: TimeSlot): boolean {
  return entries.some(e => isSameDay(e.date, date) && e.slot === slot);
}

/** Compute day-level availability color from per-slot statuses across the 5 visible slots. */
function computeDayStatus(
  date: Date,
  getSlotStatus?: (date: Date, slot: TimeSlot) => SlotStatus,
): 'high' | 'medium' | 'low' | 'none' | null {
  if (!getSlotStatus) return null;
  let allFree = 0;
  let someFree = 0;
  let known = 0;
  for (const t of TIME_SLOTS) {
    const s = getSlotStatus(date, t.value);
    if (s == null) continue;
    known++;
    if (s === 'all-free') allFree++;
    else if (s === 'some-free') someFree++;
  }
  if (known === 0) return null;
  // Score: all-free = 1.0, some-free = 0.5, none = 0
  const score = (allFree + someFree * 0.5) / TIME_SLOTS.length;
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

export function SlotCalendarPicker({
  selectedDate,
  selectedSlot,
  onSelect,
  getSlotStatus,
  days = 180,
  hasFriends = false,
  multiSelect = false,
  selectedSlots = [],
  onToggleSlot,
  initialMonth,
}: SlotCalendarPickerProps) {
  const today = startOfDay(new Date());
  const maxDate = addDays(today, days);

  const [viewMonth, setViewMonth] = useState<Date>(
    startOfMonth(selectedDate ?? initialMonth ?? today),
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const focusedDate = selectedDate;

  const dateHasSelection = (d: Date) => selectedSlots.some(e => isSameDay(e.date, d));

  const handleDayClick = (d: Date) => {
    if (isBefore(d, today)) return;
    onSelect(d, selectedSlot || 'evening');
  };

  const handleSlotClick = (date: Date, slot: TimeSlot) => {
    if (multiSelect && onToggleSlot) {
      onToggleSlot(date, slot);
    } else {
      onSelect(date, slot);
    }
  };

  const canPrev = !isSameMonth(viewMonth, today) && !isBefore(viewMonth, today);
  const canNext = isBefore(addMonths(viewMonth, 1), addDays(maxDate, 1));

  return (
    <div className="space-y-3">
      {/* Header: month nav + legend */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">When</p>
        {hasFriends && (
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="rounded-md px-1.5 py-0.5 bg-availability-available/20 text-foreground/70">Open</span>
            <span className="rounded-md px-1.5 py-0.5 bg-availability-partial/20 text-foreground/70">Some</span>
            <span className="rounded-md px-1.5 py-0.5 bg-destructive/15 text-foreground/70">Tight</span>
          </div>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => canPrev && setViewMonth(subMonths(viewMonth, 1))}
          disabled={!canPrev}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            canPrev ? "hover:bg-accent text-foreground" : "text-muted-foreground/30",
          )}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{format(viewMonth, 'MMMM yyyy')}</p>
        <button
          type="button"
          onClick={() => canNext && setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canNext}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
            canNext ? "hover:bg-accent text-foreground" : "text-muted-foreground/30",
          )}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 px-0.5">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 px-0.5">
        {monthDays.map((d) => {
          const inMonth = isSameMonth(d, viewMonth);
          const past = isBefore(d, today);
          const isSel = focusedDate && isSameDay(d, focusedDate);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const hasSlots = multiSelect && dateHasSelection(d);
          const dayStatus = !past && inMonth ? computeDayStatus(d, getSlotStatus) : null;

          // Background tint based on availability score (lighter pastels, no dot)
          const tintClass =
            isSel ? "" :
            dayStatus === 'high'   ? "bg-availability-available/20 hover:bg-availability-available/30" :
            dayStatus === 'medium' ? "bg-availability-partial/20 hover:bg-availability-partial/30" :
            dayStatus === 'low'    ? "bg-destructive/15 hover:bg-destructive/20" :
            dayStatus === 'none'   ? "bg-muted/40" :
            "hover:bg-accent";

          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => handleDayClick(d)}
              disabled={past || !inMonth}
              className={cn(
                "relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all",
                !inMonth && "opacity-0 pointer-events-none",
                past && inMonth && "text-muted-foreground/30 pointer-events-none",
                isSel
                  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary"
                  : cn(
                      tintClass,
                      isWeekend ? "text-foreground" : "text-foreground/90",
                    ),
              )}
            >
              {hasSlots && !isSel && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              {isToday(d) && !isSel && (
                <span className="absolute top-1 left-1 h-1 w-1 rounded-full bg-primary" />
              )}
              <span className="leading-none">{format(d, 'd')}</span>
            </button>
          );
        })}
      </div>

      {/* Time slot grid for selected date */}
      {focusedDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-1.5 overflow-hidden"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isToday(focusedDate) ? 'Today' : isTomorrow(focusedDate) ? 'Tomorrow' : format(focusedDate, 'EEE, MMM d')}
          </p>
          <div className="grid grid-cols-5 gap-1">
            {TIME_SLOTS.map((t) => {
              const isActive = multiSelect
                ? isSlotSelected(selectedSlots, focusedDate, t.value)
                : selectedSlot === t.value;
              const status = getSlotStatus ? getSlotStatus(focusedDate, t.value) : null;
              const isBusy = status === 'none-free';

              return (
                <motion.button
                  key={t.value}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSlotClick(focusedDate, t.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-xl border py-2 px-1 text-xs font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isBusy
                        ? "border-border/50 text-muted-foreground/40 line-through"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  {hasFriends && status && !isActive && (
                    <span className={cn(
                      "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                      status === 'all-free' ? "bg-availability-available" :
                      status === 'some-free' ? "bg-availability-partial" : ""
                    )} />
                  )}
                  {multiSelect && isActive && (
                    <Check className="absolute top-0.5 right-0.5 h-2.5 w-2.5" />
                  )}
                  <span className="text-[11px] leading-tight whitespace-nowrap">{t.shortLabel}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
