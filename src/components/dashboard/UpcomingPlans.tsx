import { useMemo } from 'react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock } from 'lucide-react';

export function UpcomingPlans() {
  const { plans } = usePlannerStore();

  const upcomingPlans = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    return plans
      .filter((p) => isAfter(p.date, now) && isBefore(p.date, weekFromNow))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [plans]);

  if (upcomingPlans.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h3 className="mb-4 font-display text-lg font-semibold">Upcoming Plans</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 text-4xl">📅</div>
          <p className="text-muted-foreground">No upcoming plans this week</p>
          <p className="text-sm text-muted-foreground">Create a new plan or chat with Elly!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h3 className="mb-4 font-display text-lg font-semibold">Upcoming Plans</h3>
      
      <div className="space-y-3">
        {upcomingPlans.map((plan) => {
          const activityConfig = ACTIVITY_CONFIG[plan.activity];
          const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
          
          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-xl border-l-4 bg-muted/30 p-4 transition-all duration-200 hover:bg-muted/50",
                `border-l-${activityConfig.color}`
              )}
              style={{ borderLeftColor: `hsl(var(--${activityConfig.color}))` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <span className="text-2xl">{activityConfig.icon}</span>
                  <div>
                    <h4 className="font-medium">{plan.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {timeSlotConfig.time}
                      </span>
                      {plan.participants.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {plan.participants.map((p) => p.name).join(', ')}
                        </span>
                      )}
                      {plan.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {plan.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{format(plan.date, 'EEE')}</p>
                  <p className="text-xs text-muted-foreground">{format(plan.date, 'MMM d')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
