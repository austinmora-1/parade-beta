import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, VIBE_CONFIG as PLANNER_VIBE_CONFIG, VibeType } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getElephantAvatar } from '@/lib/elephantAvatars';

interface FriendVibe {
  friend: Friend;
  currentVibe: string | null;
  customVibeTags: string[] | null;
  vibeGifUrl: string | null;
}

const VIBE_LABELS: Record<string, { emoji: string; label: string }> = {
  social: { emoji: '🎉', label: 'Social' },
  chill: { emoji: '😌', label: 'Chill' },
  athletic: { emoji: '💪', label: 'Athletic' },
  productive: { emoji: '⚡', label: 'Productive' },
  custom: { emoji: '✨', label: 'Custom' },
};

export function FriendVibeStrip() {
  const { friends } = usePlannerStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friendVibes, setFriendVibes] = useState<FriendVibe[]>([]);

  const connectedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'connected' && f.friendUserId);
  }, [friends]);

  useEffect(() => {
    if (connectedFriends.length === 0) {
      setFriendVibes([]);
      return;
    }

    const fetchVibes = async () => {
      const friendUserIds = connectedFriends.map(f => f.friendUserId!);
      const { data } = await supabase
        .from('profiles')
        .select('user_id, current_vibe, custom_vibe_tags, vibe_gif_url')
        .in('user_id', friendUserIds);

      const profileMap = new Map((data || []).map(p => [p.user_id, p]));

      const vibes: FriendVibe[] = connectedFriends.map(friend => {
        const profile = profileMap.get(friend.friendUserId!);
        return {
          friend,
          currentVibe: profile?.current_vibe || null,
          customVibeTags: profile?.custom_vibe_tags || null,
          vibeGifUrl: profile?.vibe_gif_url || null,
        };
      });

      // Sort: friends with a vibe first
      vibes.sort((a, b) => {
        const aHas = a.currentVibe ? 1 : 0;
        const bHas = b.currentVibe ? 1 : 0;
        return bHas - aHas;
      });

      setFriendVibes(vibes);
    };

    fetchVibes();
  }, [connectedFriends]);

  if (connectedFriends.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {friendVibes.map(({ friend, currentVibe, customVibeTags }) => {
        const vibeInfo = currentVibe ? VIBE_LABELS[currentVibe] : null;
        const isCustom = currentVibe === 'custom';
        const vibeLabel = isCustom && customVibeTags?.length
          ? `#${customVibeTags[0]}`
          : vibeInfo?.emoji
            ? `${vibeInfo.emoji}`
            : null;

        return (
          <button
            key={friend.id}
            onClick={() => {
              if (friend.friendUserId) navigate(`/friend/${friend.friendUserId}`);
            }}
            className="flex flex-col items-center gap-1 shrink-0 w-16 group"
          >
            {/* Avatar */}
            <div className={cn(
              "relative h-12 w-12 rounded-full ring-1 ring-border overflow-hidden",
              currentVibe && "ring-2 ring-primary/40"
            )}>
              {friend.avatar ? (
                <img
                  src={friend.avatar}
                  alt={friend.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={getElephantAvatar(friend.name)}
                  alt={friend.name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            {/* Name */}
            <span className="text-[11px] font-medium text-foreground truncate w-full text-center leading-tight">
              {friend.name.split(' ')[0]}
            </span>

            {/* Vibe */}
            <span className={cn(
              "text-[10px] truncate w-full text-center leading-tight -mt-0.5",
              currentVibe ? "text-primary font-medium" : "text-muted-foreground/50"
            )}>
              {vibeLabel || '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
