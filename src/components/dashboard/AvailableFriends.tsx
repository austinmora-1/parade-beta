import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AvailableFriends() {
  const { friends, availability } = usePlannerStore();
  const today = new Date();

  // Get connected friends (in a real app, we'd check their availability too)
  const connectedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'connected');
  }, [friends]);

  // For now, show connected friends as "available" - in a real app we'd check their actual availability
  const availableFriends = connectedFriends.slice(0, 4);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-activity-drinks/20 text-activity-drinks',
      'bg-activity-sports/20 text-activity-sports',
      'bg-activity-music/20 text-activity-music',
      'bg-activity-nature/20 text-activity-nature',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (connectedFriends.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Users className="h-5 w-5 text-primary" />
            Available Today
          </h3>
          <Link to="/friends">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No friends connected yet</p>
          <Link to="/friends" className="mt-2">
            <Button size="sm" variant="outline">
              Add Friends
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Users className="h-5 w-5 text-availability-available" />
          Available Today
          {availableFriends.length > 0 && (
            <span className="rounded-full bg-availability-available/10 px-2 py-0.5 text-xs font-medium text-availability-available">
              {availableFriends.length}
            </span>
          )}
        </h3>
        <Link to="/friends">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {availableFriends.map((friend) => (
          <div
            key={friend.id}
            className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/20 hover:shadow-soft"
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold",
                getAvatarColor(friend.name)
              )}
            >
              {friend.avatar ? (
                <img
                  src={friend.avatar}
                  alt={friend.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                getInitials(friend.name)
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{friend.name}</p>
              <p className="text-xs text-availability-available">Free today</p>
            </div>

            {/* Action */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {connectedFriends.length > 4 && (
        <Link to="/friends" className="mt-3 block">
          <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
            See {connectedFriends.length - 4} more friends
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}
