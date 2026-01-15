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
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

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
                Invite friends to connect and start planning together!
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
