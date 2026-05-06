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

// Common quick-pick times (24h)
const QUICK_TIMES = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
];

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
      <PopoverContent align="start" className="w-64 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2">{label}</div>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
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
