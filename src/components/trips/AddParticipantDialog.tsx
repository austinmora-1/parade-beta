import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getElephantAvatar } from '@/lib/elephantAvatars';

interface Friend {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AddParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'proposal' or 'trip' */
  targetType: 'proposal' | 'trip';
  targetId: string;
  /** User IDs already participating (to exclude from search) */
  existingParticipantIds: string[];
  onAdded: () => Promise<void>;
}

export function AddParticipantDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  existingParticipantIds,
  onAdded,
}: AddParticipantDialogProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const fetchFriends = useCallback(async () => {
    if (!user || !open) return;
    setLoading(true);
    const { data } = await supabase
      .from('friendships')
      .select('friend_user_id')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .not('friend_user_id', 'is', null);

    if (data && data.length > 0) {
      const friendIds = data
        .map(f => f.friend_user_id!)
        .filter(id => !existingParticipantIds.includes(id));

      if (friendIds.length > 0) {
        const { data: profiles } = await supabase
          .rpc('get_display_names_for_users', { p_user_ids: friendIds });
        if (profiles) setFriends(profiles);
        else setFriends([]);
      } else {
        setFriends([]);
      }
    } else {
      setFriends([]);
    }
    setLoading(false);
  }, [user, open, existingParticipantIds]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setAddedIds(new Set());
      fetchFriends();
    }
  }, [open, fetchFriends]);

  const filtered = search.trim()
    ? friends.filter(f =>
        f.display_name?.toLowerCase().includes(search.toLowerCase())
      )
    : friends;

  const handleAdd = async (friend: Friend) => {
    setAdding(friend.user_id);
    try {
      if (targetType === 'proposal') {
        const { error } = await supabase
          .from('trip_proposal_participants')
          .insert({
            proposal_id: targetId,
            user_id: friend.user_id,
            status: 'pending',
          });
        if (error) throw error;
      } else {
        // For regular trips, add to trip_participants
        const { error } = await supabase
          .from('trip_participants')
          .insert({
            trip_id: targetId,
            friend_user_id: friend.user_id,
          });
        if (error) throw error;

        // Also add to priority_friend_ids
        const { data: trip } = await supabase
          .from('trips')
          .select('priority_friend_ids')
          .eq('id', targetId)
          .single();
        if (trip) {
          const ids = [...(trip.priority_friend_ids || [])];
          if (!ids.includes(friend.user_id)) {
            ids.push(friend.user_id);
            await supabase
              .from('trips')
              .update({ priority_friend_ids: ids })
              .eq('id', targetId);
          }
        }
      }

      setAddedIds(prev => new Set(prev).add(friend.user_id));
      toast.success(`Added ${friend.display_name}`);
      await onAdded();
    } catch (err: any) {
      console.error('Failed to add participant:', err);
      if (err?.code === '23505') {
        toast.error('Already added');
      } else {
        toast.error('Failed to add participant');
      }
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Add Participant</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {friends.length === 0 ? 'All friends already added' : 'No matching friends'}
            </p>
          ) : (
            filtered.map(friend => {
              const isAdded = addedIds.has(friend.user_id);
              return (
                <div
                  key={friend.user_id}
                  className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={friend.avatar_url || getElephantAvatar(friend.display_name)} />
                    <AvatarFallback className="text-[9px]">
                      {(friend.display_name || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1 truncate">
                    {friend.display_name || 'Friend'}
                  </span>
                  <Button
                    variant={isAdded ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-6 text-xs gap-1 px-2"
                    disabled={isAdded || adding === friend.user_id}
                    onClick={() => handleAdd(friend)}
                  >
                    {adding === friend.user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isAdded ? (
                      <><Check className="h-3 w-3" /> Added</>
                    ) : (
                      <><UserPlus className="h-3 w-3" /> Add</>
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
