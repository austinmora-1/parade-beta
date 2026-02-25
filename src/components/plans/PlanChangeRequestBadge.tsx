import { format } from 'date-fns';
import { Clock, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { PlanChangeRequest } from '@/hooks/usePlanChangeRequests';
import { usePlannerStore } from '@/stores/plannerStore';
import { cn } from '@/lib/utils';

interface PlanChangeRequestBadgeProps {
  changeRequest: PlanChangeRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  isResponding?: boolean;
}

export function PlanChangeRequestBadge({
  changeRequest,
  onAccept,
  onDecline,
  isResponding = false,
}: PlanChangeRequestBadgeProps) {
  const { userId } = usePlannerStore();
  const isProposer = changeRequest.proposedBy === userId;
  const myResponse = changeRequest.responses.find(r => r.participantId === userId);
  const hasResponded = myResponse && myResponse.response !== 'pending';

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          {isProposer ? 'Change Proposed' : 'Time Change Requested'}
        </span>
        <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 ml-auto">
          Pending
        </Badge>
      </div>

      <div className="text-xs space-y-1 text-muted-foreground">
        {changeRequest.proposedDate && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>New date: <span className="font-medium text-foreground">{format(changeRequest.proposedDate, 'EEE, MMM d')}</span></span>
          </div>
        )}
        {changeRequest.proposedTimeSlot && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>New time: <span className="font-medium text-foreground">
              {TIME_SLOT_LABELS[changeRequest.proposedTimeSlot as TimeSlot]?.time || changeRequest.proposedTimeSlot}
            </span></span>
          </div>
        )}
        {changeRequest.proposedDuration && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>New duration: <span className="font-medium text-foreground">
              {changeRequest.proposedDuration >= 60
                ? `${Math.floor(changeRequest.proposedDuration / 60)}h${changeRequest.proposedDuration % 60 > 0 ? ` ${changeRequest.proposedDuration % 60}m` : ''}`
                : `${changeRequest.proposedDuration}m`}
            </span></span>
          </div>
        )}
      </div>

      {/* Response status */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {changeRequest.responses.map(resp => (
          <div
            key={resp.id}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              resp.response === 'accepted' && "bg-green-500/10 text-green-600 dark:text-green-400",
              resp.response === 'declined' && "bg-red-500/10 text-red-600 dark:text-red-400",
              resp.response === 'pending' && "bg-muted text-muted-foreground",
            )}
          >
            {resp.response === 'accepted' && <Check className="h-2.5 w-2.5" />}
            {resp.response === 'declined' && <X className="h-2.5 w-2.5" />}
            {resp.response === 'pending' && <Clock className="h-2.5 w-2.5" />}
            {resp.participantName}
          </div>
        ))}
      </div>

      {/* Action buttons for participants */}
      {!isProposer && !hasResponded && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
            onClick={() => onDecline(changeRequest.id)}
            disabled={isResponding}
          >
            <X className="h-3 w-3 mr-1" />
            Decline
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={() => onAccept(changeRequest.id)}
            disabled={isResponding}
          >
            <Check className="h-3 w-3 mr-1" />
            Accept
          </Button>
        </div>
      )}

      {!isProposer && hasResponded && (
        <p className="text-[10px] text-muted-foreground pt-1">
          You {myResponse.response === 'accepted' ? 'accepted' : 'declined'} this change.
        </p>
      )}
    </div>
  );
}
