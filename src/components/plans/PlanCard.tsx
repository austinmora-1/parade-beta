import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, MoreVertical, Trash2, Eye } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { FriendLink } from '@/components/ui/FriendLink';
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
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc', category: 'staying-in' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];

  const isTentative = plan.status === 'tentative';

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
          <span className="truncate font-medium">{plan.title}</span>
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
        // Only fire on primary button and if the target isn't an interactive child
        if (e.button === 0 && !(e.target as HTMLElement).closest('[data-stop-card-click]')) {
          onEdit?.(plan);
        }
      }}
      className={cn(
        "group rounded-2xl border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-glow cursor-pointer touch-manipulation",
        isTentative 
          ? "border-dashed border-border/60 opacity-70" 
          : "border-border",
        changeRequest && "border-amber-500/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
            style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
          >
            <ActivityIcon config={activityConfig} size={28} />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{plan.title}</h3>
            <p className="text-sm text-muted-foreground">{activityConfig.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-1" data-stop-card-click onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
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

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>
            {format(plan.date, 'EEE, MMM d')}
            {plan.startTime || plan.endTime ? (
              <> • {plan.startTime && formatTimeDisplay(plan.startTime)}{plan.startTime && plan.endTime && ' – '}{plan.endTime && formatTimeDisplay(plan.endTime)}</>
            ) : (
              <> • {timeSlotConfig.time}</>
            )}
          </span>
        </div>
        
        {plan.duration && !plan.startTime && !plan.endTime && (
          <span className="text-muted-foreground">
            {plan.duration >= 60
              ? `${Math.floor(plan.duration / 60)}h ${plan.duration % 60 > 0 ? `${plan.duration % 60}m` : ''}`
              : `${plan.duration}m`}
          </span>
        )}
      </div>

      {(plan.participants.length > 0 || plan.location) && (
        <div className="mt-3 flex flex-wrap gap-3">
          {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {plan.participants.filter(p => p.role !== 'subscriber').map((p, i, arr) => (
                  <span key={p.id}>
                    <FriendLink userId={p.friendUserId}>
                      <span className="hover:underline">{p.name}</span>
                    </FriendLink>
                    {i < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            </div>
          )}

          {plan.participants.filter(p => p.role === 'subscriber').length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-accent/50 px-3 py-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {plan.participants.filter(p => p.role === 'subscriber').map((p, i, arr) => (
                  <span key={p.id}>
                    <FriendLink userId={p.friendUserId}>
                      <span className="hover:underline">{p.name}</span>
                    </FriendLink>
                    {i < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </span>
            </div>
          )}
          
          {plan.location && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{plan.location.name}</span>
            </div>
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
