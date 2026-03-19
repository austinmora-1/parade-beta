import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, MoreVertical, Trash2, Repeat } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PlanChangeRequestBadge } from '@/components/plans/PlanChangeRequestBadge';
import { PlanChangeRequest } from '@/hooks/usePlanChangeRequests';
import { PlanRsvpButtons } from '@/components/plans/PlanRsvpButtons';
import { usePlannerStore } from '@/stores/plannerStore';

// Format "14:30" -> "2:30pm"
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

interface PlanCardProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  changeRequest?: PlanChangeRequest;
  onAcceptChange?: (id: string) => void;
  onDeclineChange?: (id: string) => void;
  isRespondingToChange?: boolean;
}

export function PlanCard({ 
  plan, onEdit, onDelete, compact = false, 
  changeRequest, onAcceptChange, onDeclineChange, isRespondingToChange 
}: PlanCardProps) {
  const navigate = useNavigate();
  const { userId } = usePlannerStore();
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];

  const displayTitle = getPlanDisplayTitle(plan);

  const isTentative = plan.status === 'tentative';
  const isPast = (plan.endDate || plan.date) < new Date(new Date().setHours(0, 0, 0, 0));

  // Show RSVP buttons when user is a participant (not owner) with a pending/invited status on a proposed plan
  const isParticipant = plan.userId !== userId && userId;
  const needsRsvp = isParticipant && plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';
  const isPendingRsvp = isParticipant && plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted';
  const showRsvp = isParticipant && !isPast;

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg p-2 text-xs",
          isTentative && "border border-dashed border-border opacity-60"
        )}
        style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / ${isTentative ? '0.08' : '0.15'})` }}
      >
        <div className="flex items-center gap-1">
          <ActivityIcon config={activityConfig} size={14} />
          <span className="truncate font-medium">{displayTitle}</span>
          {isTentative && <span className="text-[8px] text-muted-foreground ml-auto">tentative</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerUp={(e) => {
        if (e.button === 0 && !(e.target as HTMLElement).closest('[data-stop-card-click]')) {
          if (isPast) {
            navigate(`/plan/${plan.id}`);
          } else {
            onEdit?.(plan);
          }
        }
      }}
      className={cn(
        "group flex items-start gap-2 rounded-md border border-border/50 bg-background/80 px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors touch-manipulation",
        (isTentative || isPendingRsvp) && "border-dashed border-border/60 opacity-70",
        changeRequest && "border-amber-500/30",
        needsRsvp && !isTentative && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {/* Activity icon */}
      <ActivityIcon config={activityConfig} size={14} className="shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1">
          <p className="text-xs font-medium truncate">{displayTitle}</p>
          {plan.recurringPlanId && (
            <Repeat className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          )}
          {isTentative && (
            <span className="text-[8px] text-muted-foreground">tentative</span>
          )}
          {plan.status === 'proposed' && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[8px] font-semibold text-amber-600 dark:text-amber-400">
              Awaiting response
            </span>
          )}
        </div>

        {/* Date & time row */}
        <p className="text-[10px] text-muted-foreground">
          {plan.endDate
            ? `${format(plan.date, 'EEE, MMM d')} – ${format(plan.endDate, 'MMM d')}`
            : format(plan.date, 'EEE, MMM d')}
          {plan.startTime || plan.endTime ? (
            <> · {plan.startTime && formatTimeDisplay(plan.startTime)}{plan.startTime && plan.endTime && ' – '}{plan.endTime && formatTimeDisplay(plan.endTime)}</>
          ) : (
            <> · {timeSlotConfig.time}</>
          )}
        </p>

        {/* Participants row */}
        {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
          <p className="text-[10px] text-muted-foreground truncate">
            w/ {plan.participants.filter(p => p.role !== 'subscriber').map(p => p.name).join(', ')}
          </p>
        )}

        {/* Location row */}
        {plan.location && (
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {plan.location.name}
          </p>
        )}

        {/* Inline RSVP buttons for participated plans */}
        {showRsvp && userId && (
          <div className="mt-1">
            <PlanRsvpButtons
              planId={plan.id}
              userId={userId}
              currentStatus={plan.myRsvpStatus}
              compact
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" data-stop-card-click onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onDelete?.(plan.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pending change request */}
      {changeRequest && onAcceptChange && onDeclineChange && (
        <div data-stop-card-click onClick={e => e.stopPropagation()}>
          <PlanChangeRequestBadge
            changeRequest={changeRequest}
            onAccept={onAcceptChange}
            onDecline={onDeclineChange}
            isResponding={isRespondingToChange}
          />
        </div>
      )}
    </div>
  );
}
