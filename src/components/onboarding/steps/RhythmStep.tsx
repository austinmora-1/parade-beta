import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { Clock, Sun } from 'lucide-react';

interface RhythmStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const DAYS = [
  { id: 'monday', label: 'M', fullLabel: 'Mon' },
  { id: 'tuesday', label: 'T', fullLabel: 'Tue' },
  { id: 'wednesday', label: 'W', fullLabel: 'Wed' },
  { id: 'thursday', label: 'Th', fullLabel: 'Thu' },
  { id: 'friday', label: 'F', fullLabel: 'Fri' },
  { id: 'saturday', label: 'Sa', fullLabel: 'Sat' },
  { id: 'sunday', label: 'Su', fullLabel: 'Sun' },
];

const formatTime = (decimalHour: number) => {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  if (minutes === 0) return `${displayHours}${period}`;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
};

/**
 * Step 3 of new onboarding: Rhythm.
 * Captures only the bare minimum schedule signals — work days and work hours —
 * so we can render meaningful availability immediately. Everything else
 * (social cap, preferred social windows, interests, goals) is deferred to a
 * post-onboarding "Polish your profile" card.
 */
export function RhythmStep({ data, updateData }: RhythmStepProps) {
  const toggleDay = (dayId: string) => {
    const newDays = data.workDays.includes(dayId)
      ? data.workDays.filter((d) => d !== dayId)
      : [...data.workDays, dayId];
    updateData({ workDays: newDays });
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Sun className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Your weekly rhythm</h1>
        <p className="text-muted-foreground">
          Just the basics — when are you usually heads-down?
        </p>
      </div>

      <div className="space-y-6">
        {/* Work days */}
        <div>
          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Work days
          </Label>
          <div className="flex gap-1.5">
            {DAYS.map((day) => (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-xs font-medium transition-all',
                  data.workDays.includes(day.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                {day.fullLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Work hours */}
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Typical work hours
          </Label>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground w-12 text-right">
              {formatTime(data.workStartHour)}
            </span>
            <Slider
              value={[data.workStartHour, data.workEndHour]}
              onValueChange={([start, end]) =>
                updateData({ workStartHour: start, workEndHour: end })
              }
              min={5}
              max={22}
              step={0.5}
              className="flex-1"
            />
            <span className="text-muted-foreground w-12">
              {formatTime(data.workEndHour)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            We'll mark these hours busy by default. You can fine-tune any day later.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <span className="text-sm">✨</span>
          <p className="text-xs text-muted-foreground">
            Want to set social goals, preferred hangout times, or interests? You can
            add those anytime from your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
