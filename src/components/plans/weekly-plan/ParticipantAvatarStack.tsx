import { Friend } from '@/types/planner';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { cn } from '@/lib/utils';
import { Check, X, Clock, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function getRsvpStyle(status?: string, role?: string) {
  if (role === 'subscriber') return { color: 'bg-muted', icon: Eye, label: 'Watching' };
  switch (status) {
    case 'accepted': return { color: 'bg-emerald-500', icon: Check, label: 'Going' };
    case 'declined': return { color: 'bg-destructive', icon: X, label: "Can't go" };
    case 'maybe': return { color: 'bg-amber-500', icon: Clock, label: 'Maybe' };
    default: return { color: 'bg-muted-foreground/50', icon: Clock, label: 'Pending' };
  }
}

export function ParticipantAvatarStack({ participants }: { participants: Friend[] }) {
  const sorted = [...participants].sort((a, b) => {
    const order: Record<string, number> = { accepted: 0, maybe: 1, invited: 2, declined: 3 };
    return (order[a.rsvpStatus || 'invited'] ?? 2) - (order[b.rsvpStatus || 'invited'] ?? 2);
  });
  const maxVisible = 4;
  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.length - maxVisible;

  return (
    <div className="flex items-center">
      {visible.map((p, i) => {
        const rsvp = getRsvpStyle(p.rsvpStatus, p.role);
        const RsvpIcon = rsvp.icon;
        const avatarSrc = p.avatar || getElephantAvatar(p.name || p.id);
        return (
          <TooltipProvider key={p.id} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn("relative", i > 0 && "-ml-2")}>
                  <Avatar className="h-7 w-7 border-2 border-card">
                    <AvatarImage src={avatarSrc} alt={p.name} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {(p.name || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-card",
                    rsvp.color
                  )}>
                    <RsvpIcon className="h-2 w-2 text-white" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {p.name} · {rsvp.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
      {overflow > 0 && (
        <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
