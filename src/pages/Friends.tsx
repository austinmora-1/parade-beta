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

export default function Friends() {
  const { friends, updateFriend, removeFriend, addFriend } = usePlannerStore();
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
        const { data, error } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url, bio')
          .ilike('display_name', `%${searchQuery}%`)
          .neq('user_id', user?.id || '')
          .limit(10);

        if (error) throw error;

        // Filter out users who are already friends
        const friendUserIds = friends
          .filter(f => f.friendUserId)
          .map(f => f.friendUserId);
        
        const filtered = (data || []).filter(
          (profile) => !friendUserIds.includes(profile.user_id)
        );

        setSearchResults(filtered as PublicProfile[]);
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
      // Add to local friends list with pending status
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

      // Remove from search results
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

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const connectedFriends = filteredFriends.filter((f) => f.status === 'connected');
  const pendingFriends = filteredFriends.filter((f) => f.status === 'pending');
  const invitedFriends = filteredFriends.filter((f) => f.status === 'invited');

  const handleConnect = (id: string) => {
    updateFriend(id, { status: 'connected' });
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
          <h1 className="font-display text-2xl font-bold md:text-3xl">Friends</h1>
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
        {/* Pending Requests */}
        {pendingFriends.length > 0 && (
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-availability-partial-light text-[10px] font-bold text-availability-partial md:h-6 md:w-6 md:text-xs">
                {pendingFriends.length}
              </span>
              Pending Requests
            </h2>
            <div className="space-y-2 md:space-y-3">
              {pendingFriends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onConnect={handleConnect}
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
