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
  isAvailableToday: boolean;
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
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const [{ data: profileData }, { data: availData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, current_vibe, custom_vibe_tags, vibe_gif_url')
          .in('user_id', friendUserIds),
        supabase
          .from('availability')
          .select('user_id, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night')
          .in('user_id', friendUserIds)
          .eq('date', todayStr),
      ]);

      const profileMap = new Map((profileData || []).map(p => [p.user_id, p]));
      const availMap = new Map((availData || []).map(a => [a.user_id, a]));

      const vibes: FriendVibe[] = connectedFriends.map(friend => {
        const profile = profileMap.get(friend.friendUserId!);
        const avail = availMap.get(friend.friendUserId!);
        const hasAnyFreeSlot = avail
          ? !!(avail.early_morning || avail.late_morning || avail.early_afternoon || avail.late_afternoon || avail.evening || avail.late_night)
          : false;
        return {
          friend,
          currentVibe: profile?.current_vibe || null,
          customVibeTags: profile?.custom_vibe_tags || null,
          vibeGifUrl: profile?.vibe_gif_url || null,
          isAvailableToday: hasAnyFreeSlot,
        };
      });

      // Sort: available first, then those with a vibe
      vibes.sort((a, b) => {
        const aScore = (a.isAvailableToday ? 2 : 0) + (a.currentVibe ? 1 : 0);
        const bScore = (b.isAvailableToday ? 2 : 0) + (b.currentVibe ? 1 : 0);
        return bScore - aScore;
      });

      setFriendVibes(vibes);
    };

    fetchVibes();
  }, [connectedFriends]);

  if (connectedFriends.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {friendVibes.map(({ friend, currentVibe, customVibeTags, isAvailableToday }) => {
        const vibeInfo = currentVibe ? VIBE_LABELS[currentVibe] : null;
        const isCustom = currentVibe === 'custom';
        const vibeLabel = isCustom && customVibeTags?.length
          ? `#${customVibeTags[0]}`
          : vibeInfo?.label || null;

        return (
          <button
            key={friend.id}
            onClick={() => {
              if (friend.friendUserId) navigate(`/friend/${friend.friendUserId}`);
            }}
            className="flex flex-col items-center gap-1 shrink-0 w-16 group"
          >
            {/* Avatar */}
            <div className="relative h-12 w-12">
              <div className={cn(
                "h-12 w-12 rounded-full ring-1 ring-border overflow-hidden",
                currentVibe && "ring-2 ring-primary/40"
              )}>
                <img
                  src={friend.avatar || getElephantAvatar(friend.name)}
                  alt={friend.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {/* Availability indicator dot */}
              <span className={cn(
                "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                isAvailableToday ? "bg-green-500" : "bg-muted-foreground/30"
              )} />
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
