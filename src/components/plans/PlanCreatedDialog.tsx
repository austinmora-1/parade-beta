import { format } from 'date-fns';
import { CalendarDays, MapPin, Clock, Users, PartyPopper } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ACTIVITY_CONFIG, ActivityType, TIME_SLOT_LABELS, TimeSlot, Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  if (!plan) return null;

  const activityConfig = ACTIVITY_CONFIG[plan.activity as ActivityType];
  const activeParticipants = plan.participants.filter(p => p.role !== 'subscriber');
  const timeLabel = plan.startTime && plan.endTime
    ? `${formatTime12(plan.startTime)} – ${formatTime12(plan.endTime)}`
    : TIME_SLOT_LABELS[plan.timeSlot] || plan.timeSlot;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        {/* Celebration header */}
        <div className="bg-primary/10 px-6 pt-6 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <PartyPopper className="h-6 w-6 text-primary" />
          </div>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold">Plan Created!</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Here's a summary of your new plan
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Summary content */}
        <div className="px-6 pb-2 space-y-4">
          {/* Title & Activity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ActivityIcon activity={plan.activity} className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{plan.title}</p>
              {activityConfig && (
                <p className="text-xs text-muted-foreground">{activityConfig.label}</p>
              )}
            </div>
            {plan.status === 'tentative' && (
              <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Tentative
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2.5 text-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {format(plan.date, 'EEEE, MMMM d')}
                {plan.endDate && ` – ${format(plan.endDate, 'MMM d')}`}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{timeLabel}</span>
            </div>
            {plan.location && (
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-foreground truncate">{plan.location}</span>
              </div>
            )}
          </div>

          {/* Participants */}
          {activeParticipants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{activeParticipants.length} {activeParticipants.length === 1 ? 'friend' : 'friends'} invited</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeParticipants.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {p.name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
