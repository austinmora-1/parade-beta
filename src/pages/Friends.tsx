import { useState, useEffect, useMemo } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { GroupScheduler } from '@/components/friends/GroupScheduler';
import { FriendAvatarGrid } from '@/components/friends/FriendAvatarGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, Users, Loader2, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useLastHungOut } from '@/hooks/useLastHungOut';

interface PublicProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

// Simple fuzzy match: checks if all characters of the query appear in order in the target
function fuzzyMatch(target: string, query: string): { match: boolean; score: number } {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return { match: true, score: 3 };
  if (t.startsWith(q)) return { match: true, score: 4 };
  const words = t.split(/\s+/);
  if (words.some(w => w.startsWith(q))) return { match: true, score: 2.5 };
  let qi = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIdx + 1) consecutiveBonus += 0.1;
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi === q.length) {
    const ratio = q.length / t.length;
    return { match: true, score: 1 + ratio + consecutiveBonus };
  }
  if (q.length >= 3) {
    for (const word of words) {
      const dist = levenshtein(word.slice(0, q.length + 2), q);
      if (dist <= Math.max(1, Math.floor(q.length / 3))) {
        return { match: true, score: 0.5 - dist * 0.1 };
      }
    }
  }
  return { match: false, score: 0 };
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export default function Friends() {
  const { friends, updateFriend, removeFriend, addFriend, acceptFriendRequest } = usePlannerStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const connectedFriendUserIds = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.friendUserId).map(f => f.friendUserId!),
    [friends]
  );
  const lastHungOut = useLastHungOut(connectedFriendUserIds);

  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const query = searchQuery.trim();
        const isPhoneSearch = /^\+?\d[\d\s\-()]{2,}$/.test(query);
        const [nameResult, emailResult, phoneResult] = await Promise.all([
          supabase
            .from('public_profiles')
            .select('user_id, display_name, avatar_url, bio')
            .neq('user_id', user?.id || '')
            .not('display_name', 'is', null)
            .limit(100),
          query.length >= 3 && !isPhoneSearch
            ? supabase.rpc('search_users_by_email_prefix', { p_query: query })
            : Promise.resolve({ data: [], error: null }),
          isPhoneSearch
            ? supabase.rpc('search_users_by_phone_prefix', { p_query: query })
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (nameResult.error) throw nameResult.error;
        const friendUserIds = friends.filter(f => f.friendUserId).map(f => f.friendUserId);
        const nameScored = (nameResult.data || [])
          .filter((profile) => !friendUserIds.includes(profile.user_id))
          .map(profile => ({ profile, ...fuzzyMatch(profile.display_name || '', query) }))
          .filter(r => r.match);
        const emailProfiles = (emailResult.data || [])
          .filter((p: any) => !friendUserIds.includes(p.user_id))
          .map((p: any) => ({ profile: p as PublicProfile, match: true, score: 2.8 }));
        const phoneProfiles = (phoneResult.data || [])
          .filter((p: any) => !friendUserIds.includes(p.user_id))
          .map((p: any) => ({ profile: p as PublicProfile, match: true, score: 2.9 }));
        const seen = new Set<string>();
        const merged = [...nameScored, ...phoneProfiles, ...emailProfiles]
          .sort((a, b) => b.score - a.score)
          .filter(r => { if (seen.has(r.profile.user_id!)) return false; seen.add(r.profile.user_id!); return true; })
          .slice(0, 10)
          .map(r => r.profile);
        setSearchResults(merged as PublicProfile[]);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user?.id, friends]);

  const handleSendFriendRequest = async (profile: PublicProfile) => {
    if (!user) return;
    setSendingRequest(profile.user_id);
    try {
      addFriend({
        name: profile.display_name || 'User',
        friendUserId: profile.user_id,
        avatar: profile.avatar_url || undefined,
        status: 'pending',
      });
      toast({ title: 'Friend request sent! 🎉', description: `Request sent to ${profile.display_name || 'user'}` });
      setSearchResults(prev => prev.filter(p => p.user_id !== profile.user_id));
    } catch (error: any) {
      toast({ title: 'Failed to send request', description: error.message || 'Please try again', variant: 'destructive' });
    } finally {
      setSendingRequest(null);
    }
  };

  const filteredFriends = searchQuery.trim().length > 0
    ? friends.map(f => ({ friend: f, ...fuzzyMatch(f.name, searchQuery.trim()) })).filter(r => r.match).sort((a, b) => b.score - a.score).map(r => r.friend)
    : friends;

  const connectedFriends = filteredFriends.filter(f => f.status === 'connected').sort((a, b) => {
    const aId = a.friendUserId;
    const bId = b.friendUserId;
    const aDate = aId ? lastHungOut[aId] : undefined;
    const bDate = bId ? lastHungOut[bId] : undefined;
    // Friends with no shared plans go to the top (haven't hung out yet = stand out)
    if (!aDate && !bDate) return 0;
    if (!aDate) return -1;
    if (!bDate) return 1;
    // Most recent first
    return bDate.getTime() - aDate.getTime();
  });
  const podFriends = connectedFriends.filter(f => f.isPodMember);
  const nonPodConnected = connectedFriends.filter(f => !f.isPodMember);
  const incomingRequests = filteredFriends.filter(f => f.status === 'pending' && f.isIncoming);
  const outgoingRequests = filteredFriends.filter(f => f.status === 'pending' && !f.isIncoming);
  const invitedFriends = filteredFriends.filter(f => f.status === 'invited');

  const handleTogglePod = (id: string) => {
    const friend = friends.find(f => f.id === id);
    if (friend) {
      updateFriend(id, { isPodMember: !friend.isPodMember });
      toast({
        title: friend.isPodMember ? 'Removed from Pod' : 'Added to Pod 💜',
        description: friend.isPodMember
          ? `${friend.name} removed from your Pod`
          : `${friend.name} is now in your Pod!`,
      });
    }
  };

  const handleConnect = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    if (friend?.isIncoming && friend.friendUserId) {
      await acceptFriendRequest(id, friend.friendUserId);
      toast({ title: 'Friend request accepted! 🎉', description: `You and ${friend.name} are now connected` });
    } else {
      updateFriend(id, { status: 'connected' });
    }
  };

  const handleDecline = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    await removeFriend(id);
    toast({ title: 'Request declined', description: friend ? `Declined request from ${friend.name}` : 'Friend request declined' });
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getAvatarColor = (name: string) => {
    const colors = ['bg-availability-available/20 text-availability-available', 'bg-availability-partial/20 text-availability-partial', 'bg-primary/20 text-primary', 'bg-secondary text-secondary-foreground'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold md:text-2xl">Friends</h1>
        <Button onClick={() => setInviteDialogOpen(true)} size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-9"
        />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Search className="h-3.5 w-3.5" />
            People on Parade
          </h2>
          <div className="space-y-1.5">
            {searchResults.map((profile) => (
              <div key={profile.user_id} className="flex items-center justify-between rounded-lg bg-card p-2 shadow-soft">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className={cn("text-[10px]", getAvatarColor(profile.display_name || 'U'))}>
                      {getInitials(profile.display_name || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-xs">{profile.display_name || 'User'}</p>
                    {profile.bio && <p className="text-[10px] text-muted-foreground line-clamp-1">{profile.bio}</p>}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleSendFriendRequest(profile)} disabled={sendingRequest === profile.user_id} className="gap-1 h-7 text-xs px-2">
                  {sendingRequest === profile.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && filteredFriends.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-center shadow-soft">
          <div className="text-2xl mb-1">🔍</div>
          <h3 className="text-sm font-semibold">No one found</h3>
          <p className="mt-1 text-xs text-muted-foreground">Can't find "{searchQuery}"? Invite them!</p>
          <Button onClick={() => setInviteDialogOpen(true)} size="sm" variant="outline" className="mt-2 gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            Send Invite
          </Button>
        </div>
      )}

      {/* Group Scheduler */}
      <GroupScheduler friends={friends} />

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-availability-available-light text-[10px] font-bold text-availability-available">
              {incomingRequests.length}
            </span>
            Incoming Requests
          </h2>
          <FriendAvatarGrid
            friends={incomingRequests}
            onConnect={handleConnect}
            onDecline={handleDecline}
            onRemove={removeFriend}
            showActions
          />
        </div>
      )}

      {/* My Pod */}
      {podFriends.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <Heart className="h-4 w-4 text-primary fill-primary" />
            My Pod ({podFriends.length})
          </h2>
          <FriendAvatarGrid
            friends={podFriends}
            onRemove={removeFriend}
            onTogglePod={handleTogglePod}
            lastHungOut={lastHungOut}
          />
        </div>
      )}

      {/* Connected Friends */}
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <Users className="h-4 w-4 text-availability-available" />
          Connected ({nonPodConnected.length})
        </h2>
        {nonPodConnected.length > 0 ? (
          <FriendAvatarGrid
            friends={nonPodConnected}
            onRemove={removeFriend}
            onTogglePod={handleTogglePod}
            lastHungOut={lastHungOut}
          />
        ) : connectedFriends.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 text-center shadow-soft">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="text-sm font-semibold">No friends yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">Search for friends above or invite them!</p>
            <Button onClick={() => setInviteDialogOpen(true)} size="sm" className="mt-3 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Invite Friends
            </Button>
          </div>
        ) : null}
      </div>

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-availability-partial-light text-[10px] font-bold text-availability-partial">
              {outgoingRequests.length}
            </span>
            Sent Requests
          </h2>
          <FriendAvatarGrid friends={outgoingRequests} onRemove={removeFriend} />
        </div>
      )}

      {/* Invited */}
      {invitedFriends.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
            Invited ({invitedFriends.length})
          </h2>
          <FriendAvatarGrid friends={invitedFriends} onRemove={removeFriend} />
        </div>
      )}

      <InviteFriendDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
    </div>
  );
}
