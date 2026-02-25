import { useState, useEffect } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { FriendCard } from '@/components/friends/FriendCard';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  // Exact substring match gets highest score
  if (t.includes(q)) return { match: true, score: 3 };

  // Check if target starts with query
  if (t.startsWith(q)) return { match: true, score: 4 };

  // Check individual words start with query
  const words = t.split(/\s+/);
  if (words.some(w => w.startsWith(q))) return { match: true, score: 2.5 };

  // Sequential character match (fuzzy)
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
    // All query chars found in order
    const ratio = q.length / t.length;
    return { match: true, score: 1 + ratio + consecutiveBonus };
  }

  // Levenshtein-based near match for short queries (typo tolerance)
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

  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        // Fetch a broader set of profiles and filter client-side for fuzzy matching
        const { data, error } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url, bio')
          .neq('user_id', user?.id || '')
          .not('display_name', 'is', null)
          .limit(100);

        if (error) throw error;

        // Filter out users who are already friends
        const friendUserIds = friends
          .filter(f => f.friendUserId)
          .map(f => f.friendUserId);

        const scored = (data || [])
          .filter((profile) => !friendUserIds.includes(profile.user_id))
          .map(profile => {
            const name = profile.display_name || '';
            const result = fuzzyMatch(name, searchQuery.trim());
            return { profile, ...result };
          })
          .filter(r => r.match)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(r => r.profile);

        setSearchResults(scored as PublicProfile[]);
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

      toast({
        title: 'Friend request sent! 🎉',
        description: `Request sent to ${profile.display_name || 'user'}`,
      });

      setSearchResults(prev => prev.filter(p => p.user_id !== profile.user_id));
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast({
        title: 'Failed to send request',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSendingRequest(null);
    }
  };

  // Fuzzy filter existing friends
  const filteredFriends = searchQuery.trim().length > 0
    ? friends
        .map(f => ({ friend: f, ...fuzzyMatch(f.name, searchQuery.trim()) }))
        .filter(r => r.match)
        .sort((a, b) => b.score - a.score)
        .map(r => r.friend)
    : friends;

  const connectedFriends = filteredFriends.filter((f) => f.status === 'connected');
  const incomingRequests = filteredFriends.filter((f) => f.status === 'pending' && f.isIncoming);
  const outgoingRequests = filteredFriends.filter((f) => f.status === 'pending' && !f.isIncoming);
  const invitedFriends = filteredFriends.filter((f) => f.status === 'invited');

  const handleConnect = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    if (friend?.isIncoming && friend.friendUserId) {
      await acceptFriendRequest(id, friend.friendUserId);
      toast({
        title: 'Friend request accepted! 🎉',
        description: `You and ${friend.name} are now connected`,
      });
    } else {
      updateFriend(id, { status: 'connected' });
    }
  };

  const handleDecline = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    await removeFriend(id);
    toast({
      title: 'Request declined',
      description: friend ? `Declined request from ${friend.name}` : 'Friend request declined',
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-availability-available/20 text-availability-available',
      'bg-availability-partial/20 text-availability-partial',
      'bg-primary/20 text-primary',
      'bg-secondary text-secondary-foreground',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-lg font-bold md:text-2xl">Friends</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Connect with friends and share your plans
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} size="sm" className="gap-2 self-start sm:self-auto md:size-default">
          <UserPlus className="h-4 w-4" />
          Invite Friends
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search friends or find new people..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results for App Users */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-primary">
            <Search className="h-4 w-4" />
            People on Parade
          </h2>
          <div className="space-y-2">
            {searchResults.map((profile) => (
              <div
                key={profile.user_id}
                className="flex items-center justify-between rounded-lg bg-card p-3 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className={getAvatarColor(profile.display_name || 'U')}>
                      {getInitials(profile.display_name || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{profile.display_name || 'User'}</p>
                    {profile.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{profile.bio}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendFriendRequest(profile)}
                  disabled={sendingRequest === profile.user_id}
                  className="gap-1.5"
                >
                  {sendingRequest === profile.user_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && filteredFriends.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto mb-3 text-3xl">🔍</div>
          <h3 className="font-display text-base font-semibold">No one found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Can't find "{searchQuery}"? Invite them to join Parade!
          </p>
          <Button
            onClick={() => setInviteDialogOpen(true)}
            size="sm"
            variant="outline"
            className="mt-3 gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Send Invite
          </Button>
        </div>
      )}

      {/* Friends Lists */}
      <div className="space-y-6 md:space-y-8">
      {/* Incoming Friend Requests */}
        {incomingRequests.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-availability-available-light text-[10px] font-bold text-availability-available md:h-6 md:w-6 md:text-xs">
                {incomingRequests.length}
              </span>
              Incoming Requests
            </h2>
            <div className="space-y-2 md:space-y-3">
              {incomingRequests.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onConnect={handleConnect}
                  onDecline={handleDecline}
                  onRemove={removeFriend}
                />
              ))}
            </div>
          </div>
        )}

        {/* Outgoing Requests (Sent by you) */}
        {outgoingRequests.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-availability-partial-light text-[10px] font-bold text-availability-partial md:h-6 md:w-6 md:text-xs">
                {outgoingRequests.length}
              </span>
              Sent Requests
            </h2>
            <div className="space-y-2 md:space-y-3">
              {outgoingRequests.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onRemove={removeFriend}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connected Friends */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
            <Users className="h-4 w-4 text-availability-available md:h-5 md:w-5" />
            Connected ({connectedFriends.length})
          </h2>
          {connectedFriends.length > 0 ? (
            <div className="space-y-2 md:space-y-3">
              {connectedFriends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onRemove={removeFriend}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft md:rounded-2xl md:p-8">
              <div className="mx-auto mb-3 text-4xl md:mb-4 md:text-5xl">👥</div>
              <h3 className="font-display text-base font-semibold md:text-lg">No friends yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Search for friends above or invite them to join!
              </p>
              <Button
                onClick={() => setInviteDialogOpen(true)}
                size="sm"
                className="mt-4 gap-2 md:size-default"
              >
                <UserPlus className="h-4 w-4" />
                Invite Friends
              </Button>
            </div>
          )}
        </div>

        {/* Invited */}
        {invitedFriends.length > 0 && (
          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-muted-foreground md:mb-4 md:text-lg">
              Invited ({invitedFriends.length})
            </h2>
            <div className="space-y-2 md:space-y-3">
              {invitedFriends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onRemove={removeFriend}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <InviteFriendDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
