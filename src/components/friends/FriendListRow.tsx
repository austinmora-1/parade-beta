import { Friend } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { ChevronRight, Flame, MapPin } from 'lucide-react';
import { Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface FriendListRowProps {
  friend: Friend;
  conversation?: Conversation | null;
  isAvailableToday?: boolean;
  currentVibe?: string | null;
  vibeIcon?: string | null;
  lastHungOut?: Date | null;
  locationCity?: string | null;
  isAway?: boolean;
  onOpen: (friendUserId: string, conversationId?: string) => void;
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

function formatLastHungOut(date: Date): string {
  const now = new Date();
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

function getStreakLevel(lastHungOut: Date | null): { level: number; color: string } | null {
  if (!lastHungOut) return null;
  const now = new Date();
  const diffDays = Math.round((now.getTime() - lastHungOut.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return { level: 3, color: 'text-orange-500' }; // hot streak
  if (diffDays <= 14) return { level: 2, color: 'text-amber-500' }; // warm
  if (diffDays <= 30) return { level: 1, color: 'text-amber-400/60' }; // cooling
  return null;
}

export function FriendListRow({
  friend,
  conversation,
  isAvailableToday,
  currentVibe,
  vibeIcon,
  lastHungOut: lastHungOutDate,
  locationCity,
  isAway,
  onOpen,
}: FriendListRowProps) {
  const { user } = useAuth();
  const friendUserId = friend.friendUserId;
  if (!friendUserId) return null;

  const unreadCount = conversation?.unread_count || 0;
  const lastMessage = conversation?.last_message;
  const hasUnread = unreadCount > 0;
  const streak = getStreakLevel(lastHungOutDate || null);

  // Determine subtitle
  let subtitle = 'Tap to connect';
  if (hasUnread && lastMessage) {
    subtitle = lastMessage.content.length > 40
      ? lastMessage.content.slice(0, 40) + '\u2026'
      : lastMessage.content;
  } else if (lastMessage) {
    subtitle = `Last message ${formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}`;
  } else if (currentVibe && vibeIcon) {
    subtitle = `${vibeIcon} ${currentVibe}`;
  } else if (lastHungOutDate) {
    subtitle = formatLastHungOut(lastHungOutDate);
  }

  return (
    <motion.button
      onClick={() => onOpen(friendUserId, conversation?.id)}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
        hasUnread
          ? "bg-primary/[0.04] hover:bg-primary/[0.08]"
          : "hover:bg-accent border border-transparent"
      )}
    >
      {/* Avatar with vibe ring + availability dot */}
      <div className="relative shrink-0">
        <Avatar className={cn(
          "h-10 w-10 ring-1 ring-border transition-all",
          currentVibe && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          isAvailableToday && !currentVibe && "ring-2 ring-availability-available/50 ring-offset-1 ring-offset-background"
        )}>
          <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
          <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
            {getInitials(friend.name)}
          </AvatarFallback>
        </Avatar>
        {/* Availability dot */}
        {isAvailableToday && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-availability-available animate-pulse-soft" />
        )}
      </div>

      {/* Center: Name + subtitle */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{friend.name}</p>
          {streak && (
            <Flame className={cn("h-3 w-3 shrink-0", streak.color)} />
          )}
        </div>
        <p className={cn(
          "text-xs truncate",
          hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
        )}>
          {hasUnread && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-1 align-middle" />}
          {subtitle}
        </p>
      </div>

      {/* Right: Unread badge or chevron */}
      {hasUnread ? (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unreadCount}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
      )}
    </motion.button>
  );
}
