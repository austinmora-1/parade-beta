import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, MoreVertical, Trash2, Eye, Repeat } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { FriendLink } from '@/components/ui/FriendLink';
import { ParticipantsList } from '@/components/plans/ParticipantsList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PlanChangeRequestBadge } from '@/components/plans/PlanChangeRequestBadge';
import { PlanChangeRequest } from '@/hooks/usePlanChangeRequests';

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
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];

  const displayTitle = getPlanDisplayTitle(plan);

  const isTentative = plan.status === 'tentative';
  const isPast = (plan.endDate || plan.date) < new Date(new Date().setHours(0, 0, 0, 0));

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
        "group rounded-xl border bg-card px-3 py-2.5 shadow-soft transition-all duration-200 hover:shadow-glow cursor-pointer touch-manipulation",
        isTentative 
          ? "border-dashed border-border/60 opacity-70" 
          : "border-border",
        changeRequest && "border-amber-500/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-2.5 items-center">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg shrink-0"
            style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
          >
            <ActivityIcon config={activityConfig} size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display text-sm font-semibold truncate">{displayTitle}</h3>
              {plan.recurringPlanId && (
                <span title="Recurring plan"><Repeat className="h-3 w-3 text-muted-foreground shrink-0" /></span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {plan.endDate
                  ? `${format(plan.date, 'EEE, MMM d')} – ${format(plan.endDate, 'MMM d')}`
                  : format(plan.date, 'EEE, MMM d')}
                {plan.startTime || plan.endTime ? (
                  <> • {plan.startTime && formatTimeDisplay(plan.startTime)}{plan.startTime && plan.endTime && '–'}{plan.endTime && formatTimeDisplay(plan.endTime)}</>
                ) : (
                  <> • {timeSlotConfig.time}</>
                )}
              </span>
              {plan.duration && !plan.startTime && !plan.endTime && (
                <span>
                  {plan.duration >= 60
                    ? `${Math.floor(plan.duration / 60)}h${plan.duration % 60 > 0 ? ` ${plan.duration % 60}m` : ''}`
                    : `${plan.duration}m`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" data-stop-card-click onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5" />
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
      </div>

      {(plan.participants.filter(p => p.role !== 'subscriber').length > 0 || plan.location) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-[46px]">
          {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
            <div className="flex items-center gap-1" data-stop-card-click onClick={e => e.stopPropagation()}>
              <Users className="h-3 w-3" />
              <ParticipantsList participants={plan.participants.filter(p => p.role !== 'subscriber')} />
            </div>
          )}

          {plan.participants.filter(p => p.role === 'subscriber').length > 0 && (
            <div className="flex items-center gap-1" data-stop-card-click onClick={e => e.stopPropagation()}>
              <Eye className="h-3 w-3" />
              <ParticipantsList participants={plan.participants.filter(p => p.role === 'subscriber')} />
            </div>
          )}
          
          {plan.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {plan.location.name}
            </span>
          )}
        </div>
      )}

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
