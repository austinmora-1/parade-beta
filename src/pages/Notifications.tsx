import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Check, X, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Notifications() {
  const { friends, acceptFriendRequest, removeFriend } = usePlannerStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const incomingRequests = friends.filter(f => f.status === 'pending' && f.isIncoming);

  const handleAccept = async (id: string) => {
    const friend = friends.find(f => f.id === id);
    if (friend?.friendUserId) {
      await acceptFriendRequest(id, friend.friendUserId);
      toast({
        title: 'Friend request accepted! 🎉',
        description: `You and ${friend.name} are now connected`,
      });
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
      <div>
        <h1 className="font-display text-lg font-bold md:text-2xl">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Stay updated with friend requests and activity
        </p>
      </div>

      {/* Friend Requests Section */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold md:mb-4 md:text-lg">
          <UserPlus className="h-4 w-4 text-primary md:h-5 md:w-5" />
          Friend Requests
          {incomingRequests.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground md:h-6 md:w-6 md:text-xs">
              {incomingRequests.length}
            </span>
          )}
        </h2>

        {incomingRequests.length > 0 ? (
          <div className="space-y-3">
            {incomingRequests.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={friend.avatar} />
                    <AvatarFallback className={getAvatarColor(friend.name)}>
                      {getInitials(friend.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    <p className="text-sm text-muted-foreground">wants to connect with you</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(friend.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => handleAccept(friend.id)}>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft md:rounded-2xl md:p-8">
            <div className="mx-auto mb-3 text-4xl md:mb-4 md:text-5xl">🔔</div>
            <h3 className="font-display text-base font-semibold md:text-lg">No new notifications</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You're all caught up! When friends send you requests, they'll appear here.
            </p>
            <Button
              onClick={() => navigate('/friends')}
              size="sm"
              variant="outline"
              className="mt-4 gap-2"
            >
              <Users className="h-4 w-4" />
              Find Friends
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
