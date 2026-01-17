import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { X, Home, Plane } from 'lucide-react';
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
    availability,
    currentVibe, 
    getLocationStatusForDate, 
    setLocationStatus,
    setAvailability,
    setVibe 
  } = usePlannerStore();

  const locationStatus = getLocationStatusForDate(selectedDate);
  
  const dayPlans = useMemo(() => {
    return plans.filter((p) => isSameDay(p.date, selectedDate));
  }, [plans, selectedDate]);

  const vibeOptions = Object.entries(VIBE_CONFIG).filter(([key]) => key !== 'custom');

  const getSlotStatus = (slot: TimeSlot) => {
    const hasPlan = plans.some(
      (p) => isSameDay(p.date, selectedDate) && p.timeSlot === slot
    );
    if (hasPlan) return 'busy';

    const dayAvail = availability.find((a) => isSameDay(a.date, selectedDate));
    if (dayAvail && !dayAvail.slots[slot]) return 'unavailable';

    return 'available';
  };

  const toggleSlot = (slot: TimeSlot) => {
    const currentStatus = getSlotStatus(slot);
    if (currentStatus === 'busy') return;

    const dayAvail = availability.find((a) => isSameDay(a.date, selectedDate));
    const isCurrentlyAvailable = dayAvail ? dayAvail.slots[slot] : true;
    setAvailability(selectedDate, slot, !isCurrentlyAvailable);
  };

  if (!isOpen) return null;

  const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{format(selectedDate, 'EEEE, MMM d')}</span>
        <button 
          onClick={() => onOpenChange(false)}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Availability Slots */}
      <div className="grid grid-cols-3 gap-1">
        {slots.map((slot) => {
          const status = getSlotStatus(slot);
          return (
            <button
              key={slot}
              onClick={() => toggleSlot(slot)}
              disabled={status === 'busy'}
              className={cn(
                "flex flex-col items-center justify-center rounded-md py-1.5 px-1 transition-all",
                status === 'available' &&
                  "bg-availability-available-light hover:bg-availability-available/30 active:scale-95",
                status === 'unavailable' &&
                  "bg-muted/50 hover:bg-muted active:scale-95",
                status === 'busy' &&
                  "bg-availability-busy-light cursor-not-allowed opacity-60"
              )}
            >
              <span className={cn(
                "text-[11px] font-medium leading-tight",
                status === 'available' && "text-availability-available",
                status === 'unavailable' && "text-muted-foreground",
                status === 'busy' && "text-availability-busy"
              )}>
                {TIME_SLOT_LABELS[slot].label}
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight">
                {TIME_SLOT_LABELS[slot].time}
              </span>
            </button>
          );
        })}
      </div>

      {/* Location & Vibe Row */}
      <div className="flex gap-2">
        {/* Location Status */}
        <div className="flex-1 rounded-lg border border-border bg-background p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {locationStatus === 'home' ? (
                <Home className="h-3.5 w-3.5 text-availability-available" />
              ) : (
                <Plane className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="text-xs font-medium">
                {locationStatus === 'home' ? 'Home' : 'Away'}
              </span>
            </div>
            <Switch
              className="scale-75"
              checked={locationStatus === 'home'}
              onCheckedChange={(checked) => setLocationStatus(checked ? 'home' : 'away', selectedDate)}
            />
          </div>
        </div>

        {/* Vibe Selector */}
        <div className="flex-1 rounded-lg border border-border bg-background p-2">
          <div className="flex gap-1">
            {vibeOptions.map(([type, config]) => {
              const isSelected = currentVibe?.type === type;
              return (
                <button
                  key={type}
                  onClick={() => setVibe(isSelected ? null : { type: type as any })}
                  className={cn(
                    "flex-1 flex items-center justify-center rounded py-1 text-sm transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  title={config.label}
                >
                  {config.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plans for the Day */}
      {dayPlans.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-2">
          <span className="text-[10px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wide">Plans</span>
          <div className="space-y-1">
            {dayPlans.map((plan) => {
              const activityConfig = ACTIVITY_CONFIG[plan.activity];
              const slotLabel = TIME_SLOT_LABELS[plan.timeSlot as TimeSlot];
              return (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1"
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
        </div>
      )}
    </div>
  );
}
