import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, Friend } from '@/types/planner';
import { Heart, Home, Plane, MapPin, Loader2, ArrowRight } from 'lucide-react';
import { CollapsibleWidget } from './CollapsibleWidget';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

const SLOT_TO_DB_COL: Record<TimeSlot, string> = {
  'early-morning': 'early_morning',
  'late-morning': 'late_morning',
  'early-afternoon': 'early_afternoon',
  'late-afternoon': 'late_afternoon',
  'evening': 'evening',
  'late-night': 'late_night',
};

interface PodMemberInfo {
  friend: Friend;
  locationStatus: string | null;
  tripLocation: string | null;
  freeSlots: number;
  totalSlots: number;
  slots: Record<TimeSlot, boolean>;
  currentVibe: string | null;
}

const VIBE_CONFIG: Record<string, { label: string; color: string }> = {
  social: { label: '🎉 Social', color: 'bg-vibe-social/15 text-vibe-social' },
  chill: { label: '😌 Chill', color: 'bg-vibe-chill/15 text-vibe-chill' },
  athletic: { label: '💪 Athletic', color: 'bg-vibe-athletic/15 text-vibe-athletic' },
  productive: { label: '⚡ Productive', color: 'bg-vibe-productive/15 text-vibe-productive' },
  custom: { label: '✨ Custom', color: 'bg-primary/15 text-primary' },
};

export function PodWidget() {
  const { friends } = usePlannerStore();
  const navigate = useNavigate();
  const [podData, setPodData] = useState<PodMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const podFriends = useMemo(
    () => friends.filter(f => f.status === 'connected' && f.isPodMember),
    [friends]
  );

  useEffect(() => {
    if (podFriends.length === 0) {
      setPodData([]);
      setLoading(false);
      return;
    }

    const friendUserIds = podFriends
      .map(f => f.friendUserId)
      .filter((id): id is string => !!id);

    if (friendUserIds.length === 0) {
      setPodData([]);
      setLoading(false);
      return;
    }

    const fetchPodData = async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      const [availResult, profileResult, plansResult] = await Promise.all([
        supabase
          .from('availability')
          .select('user_id, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
          .in('user_id', friendUserIds)
          .eq('date', today),
        supabase
          .from('profiles')
          .select('user_id, location_status, current_vibe')
          .in('user_id', friendUserIds),
        supabase
          .from('plans')
          .select('user_id, time_slot')
          .in('user_id', friendUserIds)
          .gte('date', `${today}T00:00:00`)
          .lte('date', `${today}T23:59:59`),
      ]);

      // Build busy slots map
      const busySlots = new Map<string, Set<string>>();
      for (const plan of (plansResult.data || [])) {
        if (!busySlots.has(plan.user_id)) busySlots.set(plan.user_id, new Set());
        busySlots.get(plan.user_id)!.add(plan.time_slot.replace('_', '-'));
      }

      const data: PodMemberInfo[] = podFriends.map(friend => {
        const uid = friend.friendUserId!;
        const availRow = (availResult.data || []).find((r: any) => r.user_id === uid);
        const profileRow = (profileResult.data || []).find((r: any) => r.user_id === uid);
        const friendBusy = busySlots.get(uid) || new Set();

        const slots: Record<string, boolean> = {};
        let freeCount = 0;

        for (const slot of TIME_SLOT_ORDER) {
          if (friendBusy.has(slot)) {
            slots[slot] = false;
          } else if (!availRow) {
            slots[slot] = true;
            freeCount++;
          } else {
            const val = (availRow as any)[SLOT_TO_DB_COL[slot]] !== false;
            slots[slot] = val;
            if (val) freeCount++;
          }
        }

        return {
          friend,
          locationStatus: availRow?.location_status || profileRow?.location_status || 'home',
          tripLocation: availRow?.trip_location || null,
          freeSlots: freeCount,
          totalSlots: TIME_SLOT_ORDER.length,
          slots: slots as Record<TimeSlot, boolean>,
          currentVibe: profileRow?.current_vibe || null,
        };
      });

      setPodData(data);
      setLoading(false);
    };

    fetchPodData();
  }, [podFriends]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-primary/20 text-primary',
      'bg-activity-drinks/20 text-activity-drinks',
      'bg-activity-sports/20 text-activity-sports',
      'bg-activity-music/20 text-activity-music',
      'bg-activity-nature/20 text-activity-nature',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  if (podFriends.length === 0) return null;

  const viewAllLink = (
    <Link to="/friends" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
        Manage
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  return (
    <CollapsibleWidget
      title="Where's Your Pod?"
      icon={<Heart className="h-4 w-4 text-primary fill-primary" />}
      badge={
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {podFriends.length}
        </span>
      }
      headerRight={viewAllLink}
    >
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {podData.map(({ friend, locationStatus, tripLocation, freeSlots, totalSlots, slots, currentVibe }) => {
            const isAway = locationStatus === 'away';
            const hasFreeSlots = freeSlots > 0;
            const vibeInfo = currentVibe ? VIBE_CONFIG[currentVibe] : null;

            return (
              <button
                key={friend.id}
                onClick={() => {
                  if (friend.friendUserId) navigate(`/friend/${friend.friendUserId}`);
                }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/20 hover:shadow-soft text-left w-full"
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold relative",
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
                  {/* Location dot */}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center",
                    isAway ? "bg-activity-events" : "bg-availability-available"
                  )}>
                    {isAway
                      ? <Plane className="h-2.5 w-2.5 text-white" />
                      : <Home className="h-2.5 w-2.5 text-white" />
                    }
                  </div>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{friend.name}</p>
                    {vibeInfo && (
                      <span className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                        vibeInfo.color
                      )}>
                        {vibeInfo.label}
                      </span>
                    )}
                    {isAway && tripLocation && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
                        <MapPin className="h-2.5 w-2.5" />
                        {tripLocation}
                      </span>
                    )}
                  </div>

                  {/* Availability bar */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex gap-0.5 flex-1">
                      {TIME_SLOT_ORDER.map(slot => (
                        <div
                          key={slot}
                          className={cn(
                            "h-1.5 flex-1 rounded-full",
                            slots[slot] ? "bg-availability-available/60" : "bg-muted-foreground/20"
                          )}
                        />
                      ))}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium shrink-0",
                      hasFreeSlots ? "text-availability-available" : "text-muted-foreground"
                    )}>
                      {freeSlots}/{totalSlots}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </CollapsibleWidget>
  );
}
