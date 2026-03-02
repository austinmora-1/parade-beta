import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SuggestFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planTitle: string;
  existingParticipantIds: string[];
  organizerId: string;
}

export function SuggestFriendDialog({
  open,
  onOpenChange,
  planId,
  planTitle,
  existingParticipantIds,
  organizerId,
}: SuggestFriendDialogProps) {
  const { user } = useAuth();
  const { friends } = usePlannerStore();
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Show connected friends who aren't already participants or the organizer
  const availableFriends = friends.filter(
    (f) =>
      f.status === 'connected' &&
      f.friendUserId &&
      f.friendUserId !== organizerId &&
      !existingParticipantIds.includes(f.friendUserId) &&
      f.friendUserId !== user?.id
  );

  const handleSuggest = async (friendUserId: string, friendName: string) => {
    if (!user) return;
    setSending(friendUserId);
    try {
      const { error } = await supabase.from('plan_participant_requests').insert({
        plan_id: planId,
        requested_by: user.id,
        friend_user_id: friendUserId,
        friend_name: friendName,
      });

      if (error) {
        if (error.message?.includes('duplicate')) {
          toast.info('Already suggested this friend');
        } else {
          throw error;
        }
      } else {
        toast.success(`Suggested ${friendName} — waiting for organizer approval`);
      }
      setSentIds((prev) => new Set(prev).add(friendUserId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to suggest friend');
    } finally {
      setSending(null);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Suggest a Friend</DialogTitle>
          <DialogDescription>
            Suggest friends to add to "{planTitle}". The organizer will be asked to approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto py-2">
          {availableFriends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No friends available to suggest — they may already be participants.
            </p>
          ) : (
            availableFriends.map((friend) => {
              const isSent = sentIds.has(friend.friendUserId!);
              const isSending = sending === friend.friendUserId;
              return (
                <div
                  key={friend.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {getInitials(friend.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{friend.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={isSent ? 'ghost' : 'outline'}
                    disabled={isSending || isSent}
                    onClick={() => handleSuggest(friend.friendUserId!, friend.name)}
                    className="gap-1.5 shrink-0"
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isSent ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Suggested
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3.5 w-3.5" />
                        Suggest
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
