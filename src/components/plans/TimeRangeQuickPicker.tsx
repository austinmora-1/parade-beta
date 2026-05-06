import { useState } from 'react';
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
