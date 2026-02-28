import { useState } from 'react';
import { Users } from 'lucide-react';
import { Friend } from '@/types/planner';
import { FriendLink } from '@/components/ui/FriendLink';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ParticipantsListProps {
  participants: Friend[];
  /** Max participants to show inline before collapsing to count */
  threshold?: number;
  /** Compact mode for smaller text */
  compact?: boolean;
}

export function ParticipantsList({ participants, threshold = 2, compact = false }: ParticipantsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (participants.length === 0) return null;

  const textClass = compact ? 'text-xs' : 'text-sm';

  // Show names inline when at or below threshold
  if (participants.length <= threshold) {
    return (
      <span className={textClass}>
        {participants.map((p, i, arr) => (
          <span key={p.id}>
            <FriendLink userId={p.friendUserId}>
              <span className="hover:underline">{p.name}</span>
            </FriendLink>
            {i < arr.length - 1 ? ', ' : ''}
          </span>
        ))}
      </span>
    );
  }

  // Show count badge that opens dialog
  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        className={`${textClass} font-medium text-primary hover:underline cursor-pointer`}
        data-stop-card-click
      >
        {participants.length} people
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({participants.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {participants.map((p) => (
              <FriendLink key={p.id} userId={p.friendUserId}>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {p.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
              </FriendLink>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
