import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SignedImage } from '@/components/ui/SignedImage';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface FriendVibe {
  friend: Friend;
  currentVibe: string | null;
  customVibeTags: string[] | null;
  vibeGifUrl: string | null;
  isAvailableToday: boolean;
  availableSlots: TimeSlot[];
}

const VIBE_LABELS: Record<string, { emoji: string; label: string }> = {
  social: { emoji: '🎉', label: 'Social' },
  chill: { emoji: '😌', label: 'Chill' },
  athletic: { emoji: '💪', label: 'Athletic' },
  productive: { emoji: '⚡', label: 'Productive' },
  custom: { emoji: '✨', label: 'Custom' },
};

const SLOT_KEYS: { key: string; slot: TimeSlot }[] = [
  { key: 'early_morning', slot: 'early-morning' },
  { key: 'late_morning', slot: 'late-morning' },
  { key: 'early_afternoon', slot: 'early-afternoon' },
  { key: 'late_afternoon', slot: 'late-afternoon' },
  { key: 'evening', slot: 'evening' },
  { key: 'late_night', slot: 'late-night' },
];

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

  if (connectedFriends.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {friendVibes.map((fv) => (
        <FriendVibeItem key={fv.friend.id} data={fv} onNavigate={() => {
          if (fv.friend.friendUserId) navigate(`/friend/${fv.friend.friendUserId}`);
        }} />
      ))}
    </div>
  );
}

function FriendVibeItem({ data, onNavigate }: { data: FriendVibe; onNavigate: () => void }) {
  const { friend, currentVibe, customVibeTags, vibeGifUrl, isAvailableToday, availableSlots } = data;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hangSlot, setHangSlot] = useState<TimeSlot | null>(null);
  const [hangMessage, setHangMessage] = useState('');
  const [sending, setSending] = useState(false);

  const vibeInfo = currentVibe ? VIBE_LABELS[currentVibe] : null;
  const isCustom = currentVibe === 'custom';

  const handleSlotClick = (slot: TimeSlot) => {
    if (hangSlot === slot) {
      setHangSlot(null);
    } else {
      setHangSlot(slot);
    }
  };

  const handleSendHangRequest = async () => {
    if (!hangSlot || !user || !friend.friendUserId) return;

    setSending(true);
    try {
      const [{ data: friendProfile }, { data: myProfile }] = await Promise.all([
        supabase.from('profiles').select('share_code').eq('user_id', friend.friendUserId).single(),
        supabase.from('profiles').select('display_name').eq('user_id', user.id).single(),
      ]);

      if (!friendProfile?.share_code) {
        toast.error("Could not find friend's profile");
        setSending(false);
        return;
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayLabel = 'Today';

      const { error } = await supabase.functions.invoke('send-hang-request', {
        body: {
          shareCode: friendProfile.share_code,
          requesterName: myProfile?.display_name || user.email,
          requesterEmail: user.email,
          requesterUserId: user.id,
          message: hangMessage || undefined,
          selectedDay: todayStr,
          selectedDayLabel: todayLabel,
          selectedSlot: hangSlot,
          selectedSlotLabel: TIME_SLOT_LABELS[hangSlot]?.label || hangSlot,
        },
      });

      if (error) throw error;

      toast.success(`Hang request sent to ${friend.name}!`);
      setHangSlot(null);
      setHangMessage('');
      setOpen(false);
    } catch (err: any) {
      console.error('Error sending hang request:', err);
      toast.error(err.message || 'Failed to send hang request');
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setHangSlot(null);
      setHangMessage('');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex flex-col items-center gap-1 shrink-0 w-16 group">
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
            <span className={cn(
              "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
              isAvailableToday ? "bg-green-500" : "bg-muted-foreground/30"
            )} />
          </div>

          {/* Name */}
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
        {/* Header */}
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

        {/* Vibe Section */}
        <div className="p-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Current Vibe</p>
          {currentVibe ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm">
                  {vibeInfo?.emoji} {isCustom && customVibeTags?.length
                    ? customVibeTags.map(t => `#${t}`).join(' ')
                    : vibeInfo?.label}
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

        {/* Availability Section */}
        <div className="p-3 pt-0 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Available Today</p>
          {availableSlots.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {availableSlots.map(slot => {
                  const isSelected = hangSlot === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                        isSelected
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                          : "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 cursor-pointer"
                      )}
                    >
                      {TIME_SLOT_LABELS[slot].time}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tap a slot to send a hang request
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Not available today</p>
          )}
        </div>

        {/* Hang Request Form (when slot selected) */}
        {hangSlot && (
          <div className="p-3 pt-0 space-y-2 animate-fade-in">
            <Textarea
              placeholder="Add a message (optional)"
              value={hangMessage}
              onChange={e => setHangMessage(e.target.value)}
              className="resize-none text-sm min-h-[40px]"
              rows={2}
            />
            <Button
              onClick={handleSendHangRequest}
              disabled={sending}
              className="w-full gap-2"
              size="sm"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Hang Request
              <span className="text-xs opacity-80">
                · {TIME_SLOT_LABELS[hangSlot].time}
              </span>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
