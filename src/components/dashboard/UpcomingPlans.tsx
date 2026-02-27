import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isBefore, addDays, isSameDay } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
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

// Map time slots to hour ranges for filtering today's plans
const TIME_SLOT_HOURS: Record<string, { start: number; end: number }> = {
  'early-morning': { start: 6, end: 9 },
  'late-morning': { start: 9, end: 12 },
  'early-afternoon': { start: 12, end: 15 },
  'late-afternoon': { start: 15, end: 18 },
  'evening': { start: 18, end: 22 },
  'late-night': { start: 22, end: 26 },
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

type PlanStatus = 'upcoming' | 'in-progress';

function getPlanTimeStatus(plan: { date: Date; timeSlot: TimeSlot; startTime?: string; endTime?: string; duration?: number }): PlanStatus | null {
  const now = new Date();
  if (!isSameDay(plan.date, now)) return 'upcoming';

  const currentHour = now.getHours();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // If plan has specific start/end times, use those
  if (plan.startTime) {
    const startMin = parseTimeToMinutes(plan.startTime);
    const endMin = plan.endTime
      ? parseTimeToMinutes(plan.endTime)
      : startMin + (plan.duration || 60);

    if (currentMinutes < startMin) return 'upcoming';
    if (currentMinutes >= startMin && currentMinutes < endMin) return 'in-progress';
    return null; // past
  }

  // Use time slot hours
  const slotHours = TIME_SLOT_HOURS[plan.timeSlot];
  if (!slotHours) return 'upcoming';

  // Handle late-night wrapping past midnight
  const effectiveEnd = slotHours.end > 24 ? slotHours.end - 24 : slotHours.end;
  const isLateNight = slotHours.end > 24;

  if (isLateNight) {
    // Late night: 22-2am — in progress if after 22 OR before 2am
    if (currentHour >= slotHours.start || currentHour < effectiveEnd) return 'in-progress';
    if (currentHour < slotHours.start && currentHour >= effectiveEnd) return null; // past (after 2am)
    return 'upcoming';
  }

  if (currentHour < slotHours.start) return 'upcoming';
  if (currentHour >= slotHours.start && currentHour < slotHours.end) return 'in-progress';
  return null; // past
}

export function UpcomingPlans() {
  const { plans } = usePlannerStore();
  const navigate = useNavigate();

  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };

  const upcomingPlans = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    
    return plans
      .filter((p) => {
        // Future days within the week
        if (!isSameDay(p.date, now)) {
          return p.date > now && isBefore(p.date, weekFromNow);
        }
        // Today: include if upcoming or in-progress
        const status = getPlanTimeStatus(p);
        return status !== null;
      })
      .sort((a, b) => {
        const dateDiff = a.date.getTime() - b.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return (timeSlotOrder[a.timeSlot] ?? 0) - (timeSlotOrder[b.timeSlot] ?? 0);
      })
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
            const displayTitle = getPlanDisplayTitle(plan);
            const timeStatus = getPlanTimeStatus(plan);
            const isInProgress = timeStatus === 'in-progress';
            
            return (
              <div
                key={plan.id}
                onClick={() => navigate(`/plan/${plan.id}`)}
                className={cn(
                  "rounded-lg border-l-[3px] px-3 py-2 transition-all duration-200 cursor-pointer",
                  isInProgress
                    ? "bg-primary/10 hover:bg-primary/15"
                    : "bg-muted/30 hover:bg-muted/50",
                )}
                style={{ borderLeftColor: `hsl(var(--${activityConfig.color}))` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ActivityIcon config={activityConfig} size={18} />
                      <span className="text-sm font-medium">{displayTitle}</span>
                      {isInProgress && (
                        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
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
                    {isSameDay(plan.date, new Date()) ? 'Today' : format(plan.date, 'EEE, MMM d')}
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
