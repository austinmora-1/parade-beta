import { Friend } from '@/types/planner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, Clock, UserPlus, MessageCircle, MoreVertical, UserMinus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FriendCardProps {
  friend: Friend;
  onConnect?: (id: string) => void;
  onMessage?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function FriendCard({ friend, onConnect, onMessage, onRemove }: FriendCardProps) {
  const getStatusConfig = () => {
    switch (friend.status) {
      case 'connected':
        return {
          icon: Check,
          label: 'Connected',
          color: 'text-availability-available bg-availability-available-light',
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          color: 'text-availability-partial bg-availability-partial-light',
        };
      case 'invited':
        return {
          icon: UserPlus,
          label: 'Invited',
          color: 'text-muted-foreground bg-muted',
        };
      default:
        return {
          icon: UserPlus,
          label: 'Connect',
          color: 'text-muted-foreground bg-muted',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

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

  return (
    <div className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:shadow-glow">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full font-display font-semibold",
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
        <div>
          <h4 className="font-medium">{friend.name}</h4>
          <div
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              statusConfig.color
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {friend.status === 'connected' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMessage?.(friend.id)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}

        {friend.status === 'pending' && friend.isIncoming && (
          <Button size="sm" onClick={() => onConnect?.(friend.id)}>
            Accept
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onRemove?.(friend.id)}
              className="text-destructive focus:text-destructive"
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
