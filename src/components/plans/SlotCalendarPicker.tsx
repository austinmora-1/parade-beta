import { useRef, useEffect } from 'react';
import { format, addDays, isSameDay, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TimeSlot } from '@/types/planner';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

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

interface SlotCalendarPickerProps {
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
  onSelect: (date: Date, slot: TimeSlot) => void;
  /** For each date-slot combo, return availability status or null */
  getSlotStatus?: (date: Date, slot: TimeSlot) => 'all-free' | 'some-free' | 'none-free' | null;
  /** Number of days to show */
  days?: number;
  hasFriends?: boolean;
  /** Multi-select mode */
  multiSelect?: boolean;
  /** Currently selected slots in multi-select mode */
  selectedSlots?: SelectedSlotEntry[];
  /** Callback for multi-select toggle */
  onToggleSlot?: (date: Date, slot: TimeSlot) => void;
}

function isSlotSelected(entries: SelectedSlotEntry[], date: Date, slot: TimeSlot): boolean {
  return entries.some(e => isSameDay(e.date, date) && e.slot === slot);
}

export function SlotCalendarPicker({
  selectedDate,
  selectedSlot,
  onSelect,
  getSlotStatus,
  days = 30,
  hasFriends = false,
  multiSelect = false,
  selectedSlots = [],
  onToggleSlot,
}: SlotCalendarPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));

  // Track which date is "focused" for showing time slots
  const focusedDate = selectedDate;

  // Auto-scroll to selected date
  useEffect(() => {
    if (!focusedDate || !scrollRef.current) return;
    const idx = dates.findIndex(d => isSameDay(d, focusedDate));
    if (idx >= 0) {
      const el = scrollRef.current.children[idx] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [focusedDate]);

  const getDayLabel = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tmrw';
    return format(d, 'EEE');
  };

  // In multi-select, check if this date has any selected slots
  const dateHasSelection = (d: Date) => selectedSlots.some(e => isSameDay(e.date, d));

  const handleDayClick = (d: Date) => {
    if (multiSelect) {
      // Just focus the date to show time slots; don't auto-select a slot
      onSelect(d, selectedSlot || 'evening');
    } else {
      onSelect(d, selectedSlot || 'evening');
    }
  };

  const handleSlotClick = (date: Date, slot: TimeSlot) => {
    if (multiSelect && onToggleSlot) {
      onToggleSlot(date, slot);
    } else {
      onSelect(date, slot);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">When</p>
        {hasFriends && (
          <div className="flex items-center gap-2.5 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-availability-available inline-block" /> All free</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-availability-partial inline-block" /> Some</span>
          </div>
        )}
      </div>

      {/* Horizontally scrollable day strip */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dates.map((d) => {
            const isSelected = focusedDate && isSameDay(d, focusedDate);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const hasSlots = multiSelect && dateHasSelection(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => handleDayClick(d)}
                className={cn(
                  "relative flex flex-col items-center min-w-[3rem] rounded-xl px-1 py-1.5 transition-all shrink-0",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isWeekend
                      ? "text-foreground/80 hover:bg-accent"
                      : "text-muted-foreground hover:bg-accent"
                )}
              >
                {/* Multi-select dot indicator */}
                {hasSlots && !isSelected && (
                  <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
                )}
                <span className={cn(
                  "text-[10px] font-medium leading-tight",
                  isSelected ? "text-primary-foreground/80" : ""
                )}>
                  {getDayLabel(d)}
                </span>
                <span className={cn(
                  "text-base font-bold leading-tight",
                  isSelected ? "" : isWeekend ? "text-foreground" : ""
                )}>
                  {format(d, 'd')}
                </span>
                <span className={cn(
                  "text-[9px] leading-tight",
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {format(d, 'MMM')}
                </span>
              </button>
            );
          })}
        </div>
        {/* Fade hint */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* Time slot grid for selected date */}
      {focusedDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="grid grid-cols-5 gap-1 overflow-hidden"
        >
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
                {/* Availability dot */}
                {hasFriends && status && !isActive && (
                  <span className={cn(
                    "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                    status === 'all-free' ? "bg-availability-available" :
                    status === 'some-free' ? "bg-availability-partial" : ""
                  )} />
                )}
                {/* Multi-select checkmark */}
                {multiSelect && isActive && (
                  <Check className="absolute top-0.5 right-0.5 h-2.5 w-2.5" />
                )}
                <span className="text-[11px] leading-tight whitespace-nowrap">{t.shortLabel}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
