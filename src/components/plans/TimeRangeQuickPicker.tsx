import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function formatTime12(time?: string) {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${mStr}${ampm}`;
}

// Common quick-pick times (24h) — every 30 minutes from 7am to 10:30pm
const QUICK_TIMES = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
})();

interface TimePickerButtonProps {
  label: string;
  value?: string;
  onChange: (val: string | undefined) => void;
  placeholder?: string;
}

export function TimePickerButton({ label, value, onChange, placeholder = 'Pick time' }: TimePickerButtonProps) {
  const [open, setOpen] = useState(false);

  const handlePick = (t: string) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 rounded-full px-3 font-medium',
            !value && 'text-muted-foreground',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {value ? formatTime12(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2">{label}</div>
        <div className="grid grid-cols-4 gap-1.5 mb-3 max-h-64 overflow-y-auto pr-1">
          {QUICK_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handlePick(t)}
              className={cn(
                'text-xs py-1.5 rounded-lg border transition-colors',
                value === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 hover:bg-muted border-transparent',
              )}
            >
              {formatTime12(t)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="flex-1 bg-muted/40 border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface TimeRangePickerProps {
  startValue?: string;
  endValue?: string;
  onChange: (range: { start?: string; end?: string }) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
}

/**
 * Combined start/end time picker. Shows both values in one trigger.
 * Opens to "start" phase, then auto-advances to "end" phase after user picks start.
 */
export function TimeRangePicker({
  startValue,
  endValue,
  onChange,
  startPlaceholder = 'Start',
  endPlaceholder = 'End',
}: TimeRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'start' | 'end'>('start');
  const endScrollRef = useRef<HTMLDivElement | null>(null);

  // Reset phase when opening: start with whichever is missing first
  useEffect(() => {
    if (open) {
      setPhase(startValue ? 'end' : 'start');
    }
  }, [open, startValue]);

  const handlePickStart = (t: string) => {
    onChange({ start: t, end: endValue });
    // Auto-advance to end
    setPhase('end');
  };

  const handlePickEnd = (t: string) => {
    onChange({ start: startValue, end: t });
    setOpen(false);
  };

  const activeValue = phase === 'start' ? startValue : endValue;
  const handlePick = phase === 'start' ? handlePickStart : handlePickEnd;
  const heading = phase === 'start' ? 'Pick start time' : 'Pick end time';

  // Filter end times to be after start time (if start picked)
  const filteredTimes =
    phase === 'end' && startValue
      ? QUICK_TIMES.filter((t) => t > startValue)
      : QUICK_TIMES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-2 rounded-full px-3 font-medium',
            !startValue && !endValue && 'text-muted-foreground',
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className={cn(!startValue && 'text-muted-foreground')}>
            {startValue ? formatTime12(startValue) : startPlaceholder}
          </span>
          <span className="text-muted-foreground/60">–</span>
          <span className={cn(!endValue && 'text-muted-foreground')}>
            {endValue ? formatTime12(endValue) : endPlaceholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        {/* Phase tabs */}
        <div className="flex items-center gap-1 mb-3 p-1 rounded-full bg-muted/40">
          <button
            type="button"
            onClick={() => setPhase('start')}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-full transition-colors font-medium',
              phase === 'start'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Start {startValue && <span className="opacity-70">· {formatTime12(startValue)}</span>}
          </button>
          <button
            type="button"
            onClick={() => setPhase('end')}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-full transition-colors font-medium',
              phase === 'end'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            End {endValue && <span className="opacity-70">· {formatTime12(endValue)}</span>}
          </button>
        </div>

        <div className="text-xs font-semibold text-muted-foreground mb-2">{heading}</div>
        <div
          ref={endScrollRef}
          className="grid grid-cols-4 gap-1.5 mb-3 max-h-64 overflow-y-auto pr-1"
        >
          {filteredTimes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handlePick(t)}
              className={cn(
                'text-xs py-1.5 rounded-lg border transition-colors',
                activeValue === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 hover:bg-muted border-transparent',
              )}
            >
              {formatTime12(t)}
            </button>
          ))}
          {filteredTimes.length === 0 && (
            <div className="col-span-4 text-xs text-muted-foreground text-center py-4">
              No times after start. Pick a different start time.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={activeValue || ''}
            onChange={(e) => {
              const v = e.target.value || undefined;
              if (phase === 'start') {
                onChange({ start: v, end: endValue });
              } else {
                onChange({ start: startValue, end: v });
              }
            }}
            className="flex-1 bg-muted/40 border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {activeValue && (
            <button
              type="button"
              onClick={() => {
                if (phase === 'start') {
                  onChange({ start: undefined, end: endValue });
                } else {
                  onChange({ start: startValue, end: undefined });
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          {phase === 'end' && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              Done
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
