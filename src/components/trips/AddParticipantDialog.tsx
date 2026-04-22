import { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Loader2, Check, X } from 'lucide-react';
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

interface CurrentParticipant {
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
  /** Current participants displayed with remove buttons. If omitted, no remove section shown. */
  currentParticipants?: CurrentParticipant[];
  /** User IDs that may not be removed (e.g. trip owner / proposal creator). */
  nonRemovableIds?: string[];
  onAdded: () => Promise<void>;
}

export function AddParticipantDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  existingParticipantIds,
  currentParticipants = [],
  nonRemovableIds = [],
  onAdded,
}: AddParticipantDialogProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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

  const notifyAdded = async (friendUserId: string) => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      // Resolve trip context (location + dates) for nicer notification copy
      let trip_location: string | null = null;
      let trip_dates: string | null = null;
      if (targetType === 'trip') {
        const { data: trip } = await supabase
          .from('trips')
          .select('location, start_date, end_date')
          .eq('id', targetId)
          .single();
        if (trip) {
          trip_location = trip.location;
          try {
            const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            trip_dates = `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`;
          } catch { /* ignore */ }
        }
      } else {
        const { data: prop } = await supabase
          .from('trip_proposals')
          .select('destination')
          .eq('id', targetId)
          .single();
        if (prop) trip_location = prop.destination;
      }

      fetch(`https://${projectId}.supabase.co/functions/v1/on-plan-created`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'trip',
          creator_id: user.id,
          participant_ids: [friendUserId],
          trip_location,
          trip_dates,
        }),
      }).catch(() => {});
    } catch {
      // best-effort notification, ignore failures
    }
  };

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

      // Fire-and-forget notification (push + email)
      notifyAdded(friend.user_id);

      setAddedIds(prev => new Set(prev).add(friend.user_id));
      toast.success(`${friend.display_name} is in 🎉`);
      await onAdded();
    } catch (err: any) {
      console.error('Failed to add participant:', err);
      if (err?.code === '23505') {
        toast.error("They're already in");
      } else {
        toast.error("Couldn't add them — try again?");
      }
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (participant: CurrentParticipant) => {
    if (nonRemovableIds.includes(participant.user_id)) return;
    setRemoving(participant.user_id);
    try {
      if (targetType === 'proposal') {
        // Remove participant + their votes
        const { error } = await supabase
          .from('trip_proposal_participants')
          .delete()
          .eq('proposal_id', targetId)
          .eq('user_id', participant.user_id);
        if (error) throw error;

        // Best-effort: delete their votes for this proposal's dates
        const { data: dates } = await supabase
          .from('trip_proposal_dates')
          .select('id')
          .eq('proposal_id', targetId);
        const dateIds = (dates || []).map(d => d.id);
        if (dateIds.length > 0) {
          await supabase
            .from('trip_proposal_votes')
            .delete()
            .eq('user_id', participant.user_id)
            .in('date_id', dateIds);
        }
      } else {
        // Remove from trip_participants
        await supabase
          .from('trip_participants')
          .delete()
          .eq('trip_id', targetId)
          .eq('friend_user_id', participant.user_id);

        // Also remove from priority_friend_ids
        const { data: trip } = await supabase
          .from('trips')
          .select('priority_friend_ids')
          .eq('id', targetId)
          .single();
        if (trip) {
          const ids = (trip.priority_friend_ids || []).filter(
            (id: string) => id !== participant.user_id
          );
          await supabase
            .from('trips')
            .update({ priority_friend_ids: ids })
            .eq('id', targetId);
        }
      }

      toast.success(`${participant.display_name} stepped out`);
      await onAdded();
    } catch (err: any) {
      console.error('Failed to remove participant:', err);
      toast.error("Couldn't remove them — try again?");
    } finally {
      setRemoving(null);
    }
  };

  const removableCurrent = currentParticipants.filter(
    p => !nonRemovableIds.includes(p.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base">Manage Participants</DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground -mt-1">
          Add as many friends as you'd like — tap Done when finished.
        </p>

        {removableCurrent.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Current
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {removableCurrent.map(p => (
                <div
                  key={p.user_id}
                  className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
                    <AvatarFallback className="text-[9px]">
                      {(p.display_name || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1 truncate">
                    {p.display_name || 'Friend'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={removing === p.user_id}
                    onClick={() => handleRemove(p)}
                    title="Remove"
                  >
                    {removing === p.user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          {removableCurrent.length > 0 && (
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Add friends
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search friends..."
              className="pl-8 h-8 text-sm"
            />
          </div>
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

        <div className="flex justify-end pt-2 border-t">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done{addedIds.size > 0 ? ` · ${addedIds.size} added` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
