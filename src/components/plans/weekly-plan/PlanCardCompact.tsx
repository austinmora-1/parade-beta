import { useRef } from 'react';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getCompactPlanTitle } from '@/lib/planTitle';
import { getTimezoneAbbreviation } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { MapPin, Clock, CalendarDays } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { usePlannerStore } from '@/stores/plannerStore';
import { formatTime12 } from './planCardHelpers';
import { ParticipantAvatarStack } from './ParticipantAvatarStack';
import { isCalendarSourced, getCalendarSourceLabel } from '@/lib/planSource';

interface PlanCardCompactProps {
  plan: Plan;
  onTap: () => void;
  selectMode: boolean;
  selected: boolean;
  onLongPress: () => void;
  isPast?: boolean;
  isLive?: boolean;
}

export function PlanCardCompact({ plan, onTap, selectMode, selected, onLongPress, isPast = false, isLive = false }: PlanCardCompactProps) {
  const userTimezone = usePlannerStore((s) => s.userTimezone);
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
  const displayTitle = getCompactPlanTitle(plan);
  const isTentative = plan.status === 'tentative';
  const isPendingRsvp = plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';
  const hasPendingChange = !!plan.pendingChange;
  const fromCalendar = isCalendarSourced(plan);
  const calendarLabel = fromCalendar ? getCalendarSourceLabel(plan.source) : null;
  const showTentativeStyle = isTentative || isPendingRsvp || hasPendingChange;

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={cn(
        "relative w-full min-h-[100px] rounded-xl border bg-card p-3 text-left transition-all active:scale-[0.99] shadow-lg ring-1 ring-white/5 flex flex-col justify-between overflow-hidden",
        showTentativeStyle && "border-dashed border-muted-foreground/40",
        isPast && !showTentativeStyle && "bg-muted text-muted-foreground border-muted-foreground/20 shadow-none ring-0",
        isLive && !showTentativeStyle && "border-primary ring-2 ring-primary/30",
        selected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : !isLive && !isPast && "border-border"
      )}
    >
      {isLive && !showTentativeStyle && (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Live
        </span>
      )}
      <div className="flex items-start gap-2 min-w-0">
        {selectMode && (
          <Checkbox checked={selected} className="shrink-0 mt-0.5" />
        )}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="min-w-0 flex-1 overflow-hidden">
              <span className={cn("block truncate text-sm font-semibold leading-tight", showTentativeStyle && "text-muted-foreground")}>
                {displayTitle}
              </span>
            </div>
            {hasPendingChange && (
              <span className="shrink-0 rounded-full bg-muted border border-muted-foreground/20 px-1.5 py-0.5 text-[8px] font-semibold text-muted-foreground whitespace-nowrap mt-0.5">
                Proposed
              </span>
            )}
            {isPendingRsvp && !hasPendingChange && (
              <span className="shrink-0 rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap mt-0.5">
                RSVP
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0.5 min-w-0">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="text-xs">
                {plan.startTime
                  ? `${formatTime12(plan.startTime)}${plan.endTime ? ` – ${formatTime12(plan.endTime)}` : ''}`
                  : timeSlotConfig.time}
              </span>
              <span className="text-muted-foreground/60 text-xs">{getTimezoneAbbreviation(userTimezone)}</span>
            </div>
            {plan.location && (
              <div className="flex items-center gap-1 truncate min-w-0">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate text-xs">{plan.location.name.split(' · ')[0].split(', ')[0].split(' - ')[0]}</span>
              </div>
            )}
          </div>
        </div>
        {plan.participants.length > 0 && (
          <div className="shrink-0 self-center">
            <ParticipantAvatarStack participants={plan.participants} />
          </div>
        )}
      </div>
    </button>
  );
}
