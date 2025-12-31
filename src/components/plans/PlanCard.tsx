import { format } from 'date-fns';
import { Plan, ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { cn } from '@/lib/utils';
import { MapPin, Users, Clock, MoreVertical, Trash2, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface PlanCardProps {
  plan: Plan;
  onEdit?: (plan: Plan) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function PlanCard({ plan, onEdit, onDelete, compact = false }: PlanCardProps) {
  const activityConfig = ACTIVITY_CONFIG[plan.activity];
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];

  if (compact) {
    return (
      <div
        className="rounded-lg p-2 text-xs"
        style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
      >
        <div className="flex items-center gap-1">
          <span>{activityConfig.icon}</span>
          <span className="truncate font-medium">{plan.title}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:shadow-glow"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl"
            style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
          >
            {activityConfig.icon}
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
          {plan.participants.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {plan.participants.map((p) => p.name).join(', ')}
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
    </div>
  );
}
