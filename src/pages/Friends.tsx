import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { FriendCard } from '@/components/friends/FriendCard';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Search, Users } from 'lucide-react';

export default function Friends() {
  const { friends, updateFriend, removeFriend } = usePlannerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const connectedFriends = filteredFriends.filter((f) => f.status === 'connected');
  const pendingFriends = filteredFriends.filter((f) => f.status === 'pending');
  const invitedFriends = filteredFriends.filter((f) => f.status === 'invited');

  const handleConnect = (id: string) => {
    updateFriend(id, { status: 'connected' });
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Friends</h1>
          <p className="mt-1 text-muted-foreground">
            Connect with friends and share your plans
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Invite Friends
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Friends Lists */}
      <div className="space-y-8">
        {/* Pending Requests */}
        {pendingFriends.length > 0 && (
          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-availability-partial-light text-xs font-bold text-availability-partial">
                {pendingFriends.length}
              </span>
              Pending Requests
            </h2>
            <div className="space-y-3">
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
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="h-5 w-5 text-availability-available" />
            Connected ({connectedFriends.length})
          </h2>
          {connectedFriends.length > 0 ? (
            <div className="space-y-3">
              {connectedFriends.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onRemove={removeFriend}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
              <div className="mx-auto mb-4 text-5xl">👥</div>
              <h3 className="font-display text-lg font-semibold">No friends yet</h3>
              <p className="mt-2 text-muted-foreground">
                Invite friends to connect and start planning together!
              </p>
              <Button
                onClick={() => setInviteDialogOpen(true)}
                className="mt-4 gap-2"
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
            <h2 className="mb-4 font-display text-lg font-semibold text-muted-foreground">
              Invited ({invitedFriends.length})
            </h2>
            <div className="space-y-3">
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
