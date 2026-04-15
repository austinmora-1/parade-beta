import { format } from 'date-fns';
import { CalendarDays, MapPin, Clock, Users, Check } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ACTIVITY_CONFIG, ActivityType, TIME_SLOT_LABELS, TimeSlot, Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';
import { getTimezoneAbbreviation } from '@/lib/timezone';

interface PlanSummary {
  title: string;
  activity: string;
  date: Date;
  endDate?: Date;
  timeSlot: TimeSlot;
  startTime?: string;
  endTime?: string;
  duration: number;
  location?: string;
  participants: Friend[];
  status: string;
}

interface PlanCreatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanSummary | null;
}

function formatTime12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function PlanCreatedDialog({ open, onOpenChange, plan }: PlanCreatedDialogProps) {
  const userTimezone = usePlannerStore((s) => s.userTimezone);

  if (!plan) return null;

  const activityConfig = ACTIVITY_CONFIG[plan.activity as ActivityType];
  const activeParticipants = plan.participants.filter(p => p.role !== 'subscriber');
  const timeLabel = plan.startTime && plan.endTime
    ? `${formatTime12(plan.startTime)} – ${formatTime12(plan.endTime)}`
    : TIME_SLOT_LABELS[plan.timeSlot] || plan.timeSlot;
  const timeLabelStr = typeof timeLabel === 'string' ? timeLabel : timeLabel.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs p-4 gap-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Check className="h-3.5 w-3.5 text-primary" />
          </div>
          <DialogTitle className="text-sm font-semibold">Plan Created</DialogTitle>
        </div>

        {/* Compact summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            {activityConfig && <ActivityIcon config={activityConfig} className="h-4 w-4 shrink-0 text-primary" />}
            <span className="text-sm font-medium text-foreground truncate">{plan.title}</span>
            {plan.status === 'tentative' && (
              <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                Tentative
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(plan.date, 'EEE, MMM d')}
              {plan.endDate && ` – ${format(plan.endDate, 'MMM d')}`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeLabelStr}
              <span className="text-muted-foreground/60 ml-0.5">{getTimezoneAbbreviation(userTimezone)}</span>
            </span>
            {plan.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {plan.location}
              </span>
            )}
          </div>
        </div>

        {/* Participants – inline avatars */}
        {activeParticipants.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex -space-x-1.5">
              {activeParticipants.slice(0, 5).map((p) => (
                <Avatar key={p.id} className="h-5 w-5 border border-background">
                  <AvatarImage src={p.avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                    {p.name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {activeParticipants.length} invited
            </span>
          </div>
        )}

        <Button size="sm" onClick={() => onOpenChange(false)} className="w-full h-8 text-xs">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
