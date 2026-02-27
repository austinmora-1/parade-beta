import { Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, UserPlus, MoreVertical, UserMinus, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FriendAvatarGridProps {
  friends: Friend[];
  onConnect?: (id: string) => void;
  onDecline?: (id: string) => void;
  onRemove?: (id: string) => void;
  showActions?: boolean;
  lastHungOut?: Record<string, Date>;
  onTogglePod?: (id: string) => void;
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColors = [
  'bg-primary/20 text-primary',
  'bg-activity-drinks/20 text-activity-drinks',
  'bg-activity-sports/20 text-activity-sports',
  'bg-activity-music/20 text-activity-music',
  'bg-activity-nature/20 text-activity-nature',
];
const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

function formatLastHungOut(date: Date): string {
  const now = new Date();
  // Compare at day level only
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hung out today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function FriendAvatarGrid({ friends, onConnect, onDecline, onRemove, showActions = false, lastHungOut, onTogglePod }: FriendAvatarGridProps) {
  const navigate = useNavigate();

  if (friends.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {friends.map(friend => {
        const isConnected = friend.status === 'connected';
        const isPending = friend.status === 'pending';
        const isIncoming = isPending && friend.isIncoming;

        return (
          <div key={friend.id} className="group relative flex flex-col items-center gap-1">
            <div
              className={cn(
                "relative",
                isConnected && friend.friendUserId && "cursor-pointer"
              )}
              onClick={() => {
                if (isConnected && friend.friendUserId) {
                  navigate(`/friend/${friend.friendUserId}`);
                }
              }}
            >
              <Avatar className={cn(
                "h-12 w-12 md:h-14 md:w-14 ring-1 ring-border",
                isPending && !isIncoming && "ring-2 ring-muted-foreground/30 ring-offset-1 ring-offset-background"
              )}>
                <AvatarImage src={friend.avatar} />
                <AvatarFallback className={cn(
                  "text-sm font-semibold",
                  getAvatarColor(friend.name),
                  isPending && !isIncoming && "bg-muted-foreground/15 text-muted-foreground"
                )}>
                  {getInitials(friend.name)}
                </AvatarFallback>
              </Avatar>

              {/* Status indicator dot */}
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center",
                isConnected && !friend.isPodMember && "bg-availability-available",
                isConnected && friend.isPodMember && "bg-primary",
                isPending && "bg-availability-partial",
                friend.status === 'invited' && "bg-muted-foreground"
              )}>
                {isConnected && friend.isPodMember && <Heart className="h-2.5 w-2.5 text-white fill-white" />}
                {isConnected && !friend.isPodMember && <Check className="h-2.5 w-2.5 text-white" />}
                {isPending && <Clock className="h-2.5 w-2.5 text-white" />}
                {friend.status === 'invited' && <UserPlus className="h-2.5 w-2.5 text-white" />}
              </div>
            </div>

            <span className="text-[11px] font-medium text-center leading-tight line-clamp-1 max-w-full">
              {friend.name.split(' ')[0]}
            </span>
            {isConnected && friend.friendUserId && lastHungOut?.[friend.friendUserId] && (
              <span className="text-[9px] text-muted-foreground text-center leading-tight">
                {formatLastHungOut(lastHungOut[friend.friendUserId])}
              </span>
            )}

            {/* Inline actions for incoming requests */}
            {isIncoming && showActions && (
              <div className="flex gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-destructive hover:text-destructive"
                  onClick={() => onDecline?.(friend.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => onConnect?.(friend.id)}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Context menu on hover */}
            {(onRemove || onTogglePod) && !isIncoming && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  {onTogglePod && isConnected && (
                    <DropdownMenuItem
                      onClick={() => onTogglePod(friend.id)}
                      className="text-xs"
                    >
                      <Heart className={cn("mr-1.5 h-3 w-3", friend.isPodMember && "fill-primary text-primary")} />
                      {friend.isPodMember ? 'Remove from Pod' : 'Add to Pod'}
                    </DropdownMenuItem>
                  )}
                  {onRemove && (
                    <DropdownMenuItem
                      onClick={() => onRemove(friend.id)}
                      className="text-destructive focus:text-destructive text-xs"
                    >
                      <UserMinus className="mr-1.5 h-3 w-3" />
                      Remove
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}
