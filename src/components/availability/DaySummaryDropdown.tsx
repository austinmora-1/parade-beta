import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { X, Home, Plane, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { Switch } from '@/components/ui/switch';

interface DaySummaryDropdownProps {
  selectedDate: Date;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DaySummaryDropdown({ selectedDate, isOpen, onOpenChange }: DaySummaryDropdownProps) {
  const { 
    plans, 
    currentVibe, 
    getLocationStatusForDate, 
    setLocationStatus,
    setVibe 
  } = usePlannerStore();

  const locationStatus = getLocationStatusForDate(selectedDate);
  
  const dayPlans = useMemo(() => {
    return plans.filter((p) => isSameDay(p.date, selectedDate));
  }, [plans, selectedDate]);

  const vibeOptions = Object.entries(VIBE_CONFIG).filter(([key]) => key !== 'custom');

  if (!isOpen) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{format(selectedDate, 'EEEE, MMM d')}</span>
        <button 
          onClick={() => onOpenChange(false)}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
        {/* Location Status */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {locationStatus === 'home' ? (
                <Home className="h-4 w-4 text-availability-available" />
              ) : (
                <Plane className="h-4 w-4 text-primary" />
              )}
              <span className="text-sm font-medium">
                {locationStatus === 'home' ? 'Home' : 'Away'}
              </span>
            </div>
            <Switch
              checked={locationStatus === 'home'}
              onCheckedChange={(checked) => setLocationStatus(checked ? 'home' : 'away', selectedDate)}
            />
          </div>
        </div>

        {/* Vibe Selector */}
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground mb-2 block">Vibe</span>
          <div className="flex gap-1">
            {vibeOptions.map(([type, config]) => {
              const isSelected = currentVibe?.type === type;
              return (
                <button
                  key={type}
                  onClick={() => setVibe(isSelected ? null : { type: type as any })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 px-2 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{config.icon}</span>
                  <span className="hidden sm:inline">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>

      {/* Plans for the Day */}
      <div className="rounded-lg border border-border bg-background p-3">
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Plans</span>
        {dayPlans.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No plans for this day</p>
        ) : (
          <div className="space-y-1.5">
            {dayPlans.map((plan) => {
              const activityConfig = ACTIVITY_CONFIG[plan.activity];
              const slotLabel = TIME_SLOT_LABELS[plan.timeSlot as TimeSlot];
              return (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                >
                  <span className="text-sm">{activityConfig?.icon || '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{plan.title}</p>
                    <p className="text-[10px] text-muted-foreground">{slotLabel?.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
