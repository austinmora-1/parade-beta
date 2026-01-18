import { cn } from '@/lib/utils';
import { OnboardingData } from '../OnboardingWizard';
import { Clock, Briefcase } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface AvailabilityStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const DAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

const formatHour = (hour: number) => {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
};

export function AvailabilityStep({ data, updateData }: AvailabilityStepProps) {
  const toggleDay = (dayId: string) => {
    const newDays = data.workDays.includes(dayId)
      ? data.workDays.filter(d => d !== dayId)
      : [...data.workDays, dayId];
    updateData({ workDays: newDays });
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          When do you work?
        </h1>
        <p className="text-muted-foreground">
          We'll mark you as busy during these times by default.
        </p>
      </div>

      {/* Work Days */}
      <div className="mb-8">
        <label className="text-sm font-medium mb-3 block">Work days</label>
        <div className="flex gap-2">
          {DAYS.map((day) => {
            const isSelected = data.workDays.includes(day.id);
            return (
              <button
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Work Hours */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Start time</label>
            <span className="text-sm font-bold text-primary">{formatHour(data.workStartHour)}</span>
          </div>
          <Slider
            value={[data.workStartHour]}
            onValueChange={([value]) => updateData({ workStartHour: value })}
            min={5}
            max={12}
            step={1}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">End time</label>
            <span className="text-sm font-bold text-primary">{formatHour(data.workEndHour)}</span>
          </div>
          <Slider
            value={[data.workEndHour]}
            onValueChange={([value]) => updateData({ workEndHour: value })}
            min={14}
            max={22}
            step={1}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 rounded-xl bg-muted/50 p-4">
        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          You can always update your availability for specific days later.
        </p>
      </div>
    </div>
  );
}
