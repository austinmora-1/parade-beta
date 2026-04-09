import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, TIME_SLOT_LABELS, TimeSlot, VIBE_CONFIG, VibeType } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SignedImage } from '@/components/ui/SignedImage';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

interface FriendVibe {
  friend: Friend;
  currentVibe: string | null;
  customVibeTags: string[] | null;
  vibeGifUrl: string | null;
  isAvailableToday: boolean;
  availableSlots: TimeSlot[];
}

const SLOT_KEYS: { key: string; slot: TimeSlot }[] = [
  { key: 'early_morning', slot: 'early-morning' },
  { key: 'late_morning', slot: 'late-morning' },
  { key: 'early_afternoon', slot: 'early-afternoon' },
  { key: 'late_afternoon', slot: 'late-afternoon' },
  { key: 'evening', slot: 'evening' },
  { key: 'late_night', slot: 'late-night' },
];

interface FriendVibeStripProps {
  onFriendTap?: (friend: { userId: string; name: string; avatar?: string }) => void;
}

export function FriendVibeStrip({ onFriendTap }: FriendVibeStripProps = {}) {
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

        const availableSlots: TimeSlot[] = [];
        if (avail) {
          for (const { key, slot } of SLOT_KEYS) {
            if ((avail as any)[key]) availableSlots.push(slot);
          }
        }

        return {
          friend,
          currentVibe: profile?.current_vibe || null,
          customVibeTags: profile?.custom_vibe_tags || null,
          vibeGifUrl: profile?.vibe_gif_url || null,
          isAvailableToday: availableSlots.length > 0,
          availableSlots,
        };
      });

      vibes.sort((a, b) => {
        const aScore = (a.isAvailableToday ? 2 : 0) + (a.currentVibe ? 1 : 0);
        const bScore = (b.isAvailableToday ? 2 : 0) + (b.currentVibe ? 1 : 0);
        return bScore - aScore;
      });

      setFriendVibes(vibes);
    };

    fetchVibes();
  }, [connectedFriends]);

  if (connectedFriends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-5 text-center">
        <span className="text-2xl">👋</span>
        <p className="text-xs text-muted-foreground">Add friends to see their vibes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
        Who's around today
      </p>
      <div className="flex gap-2 overflow-x-auto pt-1 pb-1 -mx-1 px-1 scrollbar-hide">
        {friendVibes.map((fv, i) => (
          <motion.div
            key={fv.friend.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
          >
            <FriendVibeItem data={fv} onNavigate={() => {
              if (fv.friend.friendUserId) navigate(`/friend/${fv.friend.friendUserId}`);
            }} onFriendTap={onFriendTap} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FriendVibeItem({ data, onNavigate, onFriendTap }: { data: FriendVibe; onNavigate: () => void; onFriendTap?: (friend: { userId: string; name: string; avatar?: string }) => void }) {
  const { friend, currentVibe, customVibeTags, vibeGifUrl, isAvailableToday, availableSlots } = data;
  const [open, setOpen] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);

  const vibeConfig = currentVibe ? VIBE_CONFIG[currentVibe as VibeType] : null;
  const isCustom = currentVibe === 'custom';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/friend', JSON.stringify({
                userId: friend.friendUserId,
                name: friend.name,
                avatar: friend.avatar,
              }));
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 w-[4rem] group touch-manipulation"
          >
            <div className="relative h-12 w-12">
              <div
                className={cn(
                  "h-12 w-12 rounded-full overflow-hidden transition-all duration-200",
                  currentVibe
                    ? `ring-2 ring-offset-1 ring-offset-background`
                    : "ring-1 ring-border"
                )}
                style={currentVibe && vibeConfig ? {
                  outline: `2px solid hsl(var(--${vibeConfig.color}))`,
                  outlineOffset: '2px',
                } : undefined}
              >
                <img
                  src={friend.avatar || getElephantAvatar(friend.name)}
                  alt={friend.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {vibeConfig && (
                <span className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-background text-[11px] shadow-sm">
                  {vibeConfig.icon}
                </span>
              )}

              <span
                className={cn(
                  "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                  isAvailableToday
                    ? "bg-green-500 animate-pulse-soft"
                    : "bg-muted-foreground/25"
                )}
              />
            </div>

            <span className="text-[11px] font-medium text-foreground truncate w-full text-center leading-tight">
              {friend.name.split(' ')[0]}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-64 p-0 rounded-xl shadow-lg border border-border"
          side="bottom"
          align="center"
          sideOffset={8}
        >
          <div className="flex items-center gap-3 p-3 border-b border-border">
            <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-border shrink-0">
              <img
                src={friend.avatar || getElephantAvatar(friend.name)}
                alt={friend.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{friend.name}</p>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); onNavigate(); }}
                className="text-[11px] text-primary hover:underline"
              >
                View profile →
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Vibe</p>
            {currentVibe ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">
                    {vibeConfig?.icon} {isCustom && customVibeTags?.length
                      ? customVibeTags.map(t => `#${t}`).join(' ')
                      : vibeConfig?.label}
                  </span>
                </div>
                {vibeGifUrl && (
                  <div className="rounded-lg overflow-hidden border border-border">
                    <SignedImage
                      src={vibeGifUrl}
                      alt="Vibe GIF"
                      className="w-full h-28 object-cover"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No vibe set</p>
            )}
          </div>

          <div className="p-3 pt-0 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Available Today</p>
            {availableSlots.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {availableSlots.map(slot => (
                  <span
                    key={slot}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-500/10 text-green-700 dark:text-green-400"
                  >
                    {TIME_SLOT_LABELS[slot].time}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Not available today</p>
            )}
          </div>

          <div className="p-3 pt-0">
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                setOpen(false);
                setQuickPlanOpen(true);
              }}
            >
              <CalendarPlus className="h-4 w-4" />
              Suggest a plan
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <QuickPlanSheet
        open={quickPlanOpen}
        onOpenChange={setQuickPlanOpen}
        preSelectedFriend={{
          userId: friend.friendUserId!,
          name: friend.name,
          avatar: friend.avatar,
        }}
      />
    </>
  );
}
