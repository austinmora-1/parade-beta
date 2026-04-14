import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, MoreVertical, Trash2, Repeat, Check, X, Clock, Eye } from 'lucide-react';
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
import { getElephantAvatar } from '@/lib/elephantAvatars';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Friend } from '@/types/planner';

// Format "14:30" -> "2:30pm"
function formatTimeDisplay(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

function getRsvpBadge(status?: string) {
  switch (status) {
    case 'accepted':
      return { icon: Check, className: 'bg-emerald-500 text-white', label: 'Going' };
    case 'declined':
      return { icon: X, className: 'bg-destructive text-white', label: 'Can\'t go' };
    case 'maybe':
      return { icon: Clock, className: 'bg-amber-500 text-white', label: 'Maybe' };
    default:
      return { icon: Clock, className: 'bg-muted text-muted-foreground', label: 'Pending' };
  }
}

function ParticipantAvatar({ participant, index }: { participant: Friend; index: number }) {
  const avatarSrc = participant.avatar || getElephantAvatar(participant.name || participant.id);
  const rsvp = getRsvpBadge(participant.rsvpStatus);
  const RsvpIcon = rsvp.icon;
  const isSubscriber = participant.role === 'subscriber';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative shrink-0",
              index > 0 && "-ml-1.5"
            )}
          >
            <img
              src={avatarSrc}
              alt={participant.name}
              className={cn(
                "h-5 w-5 rounded-full object-cover border",
                isSubscriber
                  ? "border-dashed border-muted-foreground/40 opacity-70"
                  : participant.rsvpStatus === 'declined'
                    ? "border-destructive/40 opacity-50 grayscale"
                    : "border-background"
              )}
            />
            {/* RSVP status dot */}
            {!isSubscriber && (
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full flex items-center justify-center ring-1 ring-background",
                rsvp.className
              )}>
                <RsvpIcon className="h-1.5 w-1.5" strokeWidth={3} />
              </span>
            )}
            {isSubscriber && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full flex items-center justify-center bg-muted ring-1 ring-background">
                <Eye className="h-1.5 w-1.5 text-muted-foreground" strokeWidth={3} />
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs px-2 py-1">
          <span>{participant.name}</span>
          <span className="text-muted-foreground ml-1">
            · {isSubscriber ? 'Watching' : rsvp.label}
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ParticipantAvatarStack({ participants }: { participants: Friend[] }) {
  const maxVisible = 4;
  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - maxVisible;

  return (
    <div className="flex items-center mt-0.5">
      {visible.map((p, i) => (
        <ParticipantAvatar key={p.id} participant={p} index={i} />
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-muted-foreground ml-1 font-medium">
          +{overflow}
        </span>
      )}
    </div>
  );
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
  const hasPendingChange = !!plan.pendingChange;
  const isPast = (plan.endDate || plan.date) < new Date(new Date().setHours(0, 0, 0, 0));

  // Show RSVP buttons when user is a participant (not owner)
  const isParticipant = plan.userId !== userId && userId;
  const needsRsvp = isParticipant && plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';
  // Pending RSVP = invited or maybe (not yet confirmed)
  const isPendingRsvp = isParticipant && plan.myRsvpStatus && plan.myRsvpStatus !== 'accepted' && plan.myRsvpStatus !== 'declined';
  const showTentativeStyle = isTentative || isPendingRsvp || hasPendingChange;
  const showRsvp = isParticipant && !isPast;

  const nonSubscriberParticipants = plan.participants.filter(p => p.role !== 'subscriber');
  const subscriberParticipants = plan.participants.filter(p => p.role === 'subscriber');
  const allDisplayParticipants = [...nonSubscriberParticipants, ...subscriberParticipants];

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg p-2 text-xs",
          showTentativeStyle ? "border border-dashed border-muted-foreground/40 opacity-60" : ""
        )}
        style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / ${showTentativeStyle ? '0.08' : '0.15'})` }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <ActivityIcon config={activityConfig} size={14} className="shrink-0" />
          <span className="truncate font-medium min-w-0 flex-1">{displayTitle}</span>
          {isTentative && !isPendingRsvp && !hasPendingChange && <span className="text-[8px] text-muted-foreground ml-auto">tentative</span>}
          {hasPendingChange && <span className="text-[8px] text-muted-foreground ml-auto">proposed change</span>}
          {isPendingRsvp && !hasPendingChange && <span className="text-[8px] text-amber-500 ml-auto">pending</span>}
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
        showTentativeStyle && "border-dashed border-muted-foreground/40 opacity-70",
        changeRequest && !hasPendingChange && "border-amber-500/30",
        needsRsvp && !isTentative && !hasPendingChange && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {/* Activity icon */}
      <ActivityIcon config={activityConfig} size={14} className="shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-xs font-medium truncate min-w-0 flex-1">{displayTitle}</p>
          {plan.recurringPlanId && (
            <Repeat className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
          )}
          {isTentative && !isPendingRsvp && !hasPendingChange && (
            <span className="text-[8px] text-muted-foreground">tentative</span>
          )}
          {hasPendingChange && (
            <span className="rounded-full bg-muted border border-muted-foreground/20 px-2 py-0.5 text-[8px] font-semibold text-muted-foreground">
              Proposed change
            </span>
          )}
          {isPendingRsvp && !hasPendingChange && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[8px] font-semibold text-amber-600 dark:text-amber-400">
              Pending RSVP
            </span>
          )}
          {plan.status === 'proposed' && !isPendingRsvp && !hasPendingChange && (
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

        {/* Participants avatar stack with RSVP status */}
        {allDisplayParticipants.length > 0 && (
          <ParticipantAvatarStack participants={allDisplayParticipants} />
        )}

        {/* Location row */}
        {plan.location && (
          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {plan.location.name.split(' · ')[0].split(', ')[0].split(' - ')[0]}
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
