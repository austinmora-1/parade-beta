import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, MoreVertical, Trash2, Edit, Eye } from 'lucide-react';
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

  if (compact) {
    return (
      <div
        className="rounded-lg p-2 text-xs"
        style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
      >
        <div className="flex items-center gap-1">
          <ActivityIcon config={activityConfig} size={14} />
          <span className="truncate font-medium">{plan.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-glow",
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

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit?.(plan)}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
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
              <DropdownMenuItem onClick={() => onEdit?.(plan)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
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
            {format(plan.date, 'EEE, MMM d')} • {timeSlotConfig.time}
          </span>
        </div>
        
        {plan.duration && (
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
        <PlanChangeRequestBadge
          changeRequest={changeRequest}
          onAccept={onAcceptChange}
          onDecline={onDeclineChange}
          isResponding={isRespondingToChange}
        />
      )}
    </div>
  );
}
