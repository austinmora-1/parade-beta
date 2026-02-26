import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, CalendarCheck } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { CollapsibleWidget } from './CollapsibleWidget';

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function UpcomingPlans() {
  const { plans } = usePlannerStore();
  const navigate = useNavigate();

  const upcomingPlans = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    return plans
      .filter((p) => isAfter(p.date, now) && isBefore(p.date, weekFromNow))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [plans]);

  return (
    <CollapsibleWidget
      title="Upcoming Plans"
      icon={<CalendarCheck className="h-4 w-4 text-primary" />}
      badge={
        upcomingPlans.length > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {upcomingPlans.length}
          </span>
        ) : undefined
      }
    >
      {upcomingPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 text-4xl">📅</div>
          <p className="text-muted-foreground">No upcoming plans this week</p>
          <p className="text-sm text-muted-foreground">Create a new plan or chat with Elly!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {upcomingPlans.map((plan) => {
            const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc' };
            const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
            
            return (
              <div
                key={plan.id}
                onClick={() => navigate(`/plan/${plan.id}`)}
                className={cn(
                  "rounded-lg border-l-[3px] bg-muted/30 px-3 py-2 transition-all duration-200 hover:bg-muted/50 cursor-pointer",
                )}
                style={{ borderLeftColor: `hsl(var(--${activityConfig.color}))` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ActivityIcon config={activityConfig} size={18} />
                      <span className="text-sm font-medium">{plan.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 ml-[26px]">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {plan.startTime ? formatTime12(plan.startTime) + (plan.endTime ? ` – ${formatTime12(plan.endTime)}` : '') : timeSlotConfig.time}
                      </span>
                      {plan.participants.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {plan.participants.length}
                        </span>
                      )}
                      {plan.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[100px]">{plan.location.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {format(plan.date, 'EEE, MMM d')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleWidget>
  );
}
