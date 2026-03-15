import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isSameDay, format, addDays, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { Friend } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, Loader2 } from 'lucide-react';
import { CollapsibleWidget } from './CollapsibleWidget';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

// DB columns use underscores, app uses hyphens
const SLOT_TO_DB_COL: Record<TimeSlot, string> = {
  'early-morning': 'early_morning',
  'late-morning': 'late_morning',
  'early-afternoon': 'early_afternoon',
  'late-afternoon': 'late_afternoon',
  'evening': 'evening',
  'late-night': 'late_night',
};

interface FriendAvailDay {
  date: string;
  slots: Record<TimeSlot, boolean>;
}

export function AvailableFriends() {
  const { friends, availability } = usePlannerStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [friendAvail, setFriendAvail] = useState<FriendAvailDay[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const connectedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'connected');
  }, [friends]);

  // Track which friends are actually available today via useQuery
  const friendUserIds = useMemo(() => {
    return connectedFriends.map(f => f.friendUserId).filter((id): id is string => !!id);
  }, [connectedFriends]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: todayAvailableFriendIds = new Set<string>(), isLoading: loadingTodayAvail } = useQuery({
    queryKey: ['available-friends-today', friendUserIds, todayStr],
    queryFn: async () => {
      if (friendUserIds.length === 0) return new Set<string>();

      const [availResult, plansResult] = await Promise.all([
        supabase
          .from('availability')
          .select('user_id, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night')
          .in('user_id', friendUserIds)
          .eq('date', todayStr),
        supabase
          .from('plans')
          .select('user_id, time_slot')
          .in('user_id', friendUserIds)
          .gte('date', `${todayStr}T00:00:00`)
          .lte('date', `${todayStr}T23:59:59`),
      ]);

      if (availResult.error) {
        console.error('Error fetching friend availability:', availResult.error);
        return new Set<string>(friendUserIds);
      }

      const friendBusySlots = new Map<string, Set<string>>();
      for (const plan of (plansResult.data || [])) {
        if (!friendBusySlots.has(plan.user_id)) {
          friendBusySlots.set(plan.user_id, new Set());
        }
        friendBusySlots.get(plan.user_id)!.add(plan.time_slot.replace('_', '-'));
      }

      const availableIds = new Set<string>();
      for (const friendUserId of friendUserIds) {
        const row = availResult.data?.find(r => r.user_id === friendUserId);
        const busySlots = friendBusySlots.get(friendUserId) || new Set();
        const hasAnyFree = TIME_SLOT_ORDER.some(slot => {
          if (busySlots.has(slot)) return false;
          if (!row) return true;
          const col = SLOT_TO_DB_COL[slot];
          return (row as any)[col] !== false;
        });
        if (hasAnyFree) availableIds.add(friendUserId);
      }

      return availableIds;
    },
    enabled: friendUserIds.length > 0,
  });

  const availableFriends = useMemo(() => {
    return connectedFriends
      .filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId))
      .slice(0, 4);
  }, [connectedFriends, todayAvailableFriendIds]);

  // Track friend's plans for the week
  const [friendPlans, setFriendPlans] = useState<{ date: string; time_slot: string }[]>([]);

  // Fetch friend's availability AND plans when dialog opens
  useEffect(() => {
    if (!selectedFriend?.friendUserId) {
      setFriendAvail([]);
      setFriendPlans([]);
      return;
    }

    const fetchAvail = async () => {
      setLoadingAvail(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekOut = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      const [availResult, plansResult] = await Promise.all([
        supabase
          .from('availability')
          .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night')
          .eq('user_id', selectedFriend.friendUserId!)
          .gte('date', today)
          .lte('date', weekOut),
        supabase
          .from('plans')
          .select('date, time_slot')
          .eq('user_id', selectedFriend.friendUserId!)
          .gte('date', `${today}T00:00:00`)
          .lte('date', `${weekOut}T23:59:59`),
      ]);

      if (!availResult.error && availResult.data) {
        const mapped: FriendAvailDay[] = availResult.data.map((row: any) => ({
          date: row.date,
          slots: Object.fromEntries(
            TIME_SLOT_ORDER.map(slot => [slot, row[SLOT_TO_DB_COL[slot]] !== false])
          ) as Record<TimeSlot, boolean>,
        }));
        setFriendAvail(mapped);
      }
      
      if (!plansResult.error && plansResult.data) {
        setFriendPlans(plansResult.data.map((p: any) => ({
          date: format(new Date(p.date), 'yyyy-MM-dd'),
          time_slot: p.time_slot.replace('_', '-'),
        })));
      }
      
      setLoadingAvail(false);
    };

    fetchAvail();
  }, [selectedFriend]);

  // Generate next 7 days for day picker
  const nextDays = useMemo(() => {
    const days: { value: string; label: string; date: Date }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      days.push({
        value: format(d, 'yyyy-MM-dd'),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEE, MMM d'),
        date: d,
      });
    }
    return days;
  }, []);

  // Filter days to only those with at least one available slot
  const availableDays = useMemo(() => {
    return nextDays.filter(d => {
      const avail = friendAvail.find(a => a.date === d.value);
      return TIME_SLOT_ORDER.some(slot => {
        const hasPlan = friendPlans.some(p => p.date === d.value && p.time_slot === slot);
        if (hasPlan) return false;
        if (!avail) return true;
        return avail.slots[slot];
      });
    });
  }, [nextDays, friendAvail, friendPlans]);

  // Filter slots for selected day
  const availableSlots = useMemo(() => {
    if (!selectedDay) return TIME_SLOT_ORDER;
    const avail = friendAvail.find(a => a.date === selectedDay);
    return TIME_SLOT_ORDER.filter(slot => {
      // Exclude slots where the friend has a plan
      const hasPlan = friendPlans.some(p => p.date === selectedDay && p.time_slot === slot);
      if (hasPlan) return false;
      // Exclude slots marked as unavailable
      if (!avail) return true;
      return avail.slots[slot];
    });
  }, [selectedDay, friendAvail, friendPlans]);

  // Reset slot when day changes and slot is no longer available
  useEffect(() => {
    if (selectedSlot && !availableSlots.includes(selectedSlot as TimeSlot)) {
      setSelectedSlot('');
    }
  }, [availableSlots, selectedSlot]);

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
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

  const handleSendHangRequest = async () => {
    if (!selectedFriend || !selectedDay || !selectedSlot || !user) return;

    setSending(true);
    try {
      // Look up friend's share code
      const { data: profile } = await supabase
        .from('profiles')
        .select('share_code')
        .eq('user_id', selectedFriend.friendUserId!)
        .single();

      if (!profile?.share_code) {
        toast.error('Could not find friend\'s profile');
        setSending(false);
        return;
      }

      // Get current user's profile for name
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const dayObj = nextDays.find(d => d.value === selectedDay);

      const { error } = await supabase.functions.invoke('send-hang-request', {
        body: {
          shareCode: profile.share_code,
          requesterName: myProfile?.display_name || user.email,
          requesterEmail: user.email,
          requesterUserId: user.id,
          message: message || undefined,
          selectedDay,
          selectedDayLabel: dayObj?.label || selectedDay,
          selectedSlot,
          selectedSlotLabel: TIME_SLOT_LABELS[selectedSlot as TimeSlot]?.label || selectedSlot,
        },
      });

      if (error) throw error;

      toast.success(`Hang request sent to ${selectedFriend.name}!`);
      setSelectedFriend(null);
      setSelectedDay('');
      setSelectedSlot('');
      setMessage('');
    } catch (err: any) {
      console.error('Error sending hang request:', err);
      toast.error(err.message || 'Failed to send hang request');
    } finally {
      setSending(false);
    }
  };

  const viewAllLink = (
    <Link to="/friends" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
        View All
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  if (connectedFriends.length === 0) {
    return (
      <CollapsibleWidget
        title="Available Today"
        icon={<Users className="h-4 w-4 text-primary" />}
        headerRight={viewAllLink}
      >
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
      </CollapsibleWidget>
    );
  }

  return (
    <>
    <CollapsibleWidget
      title="Available Today"
      icon={<Users className="h-4 w-4 text-availability-available" />}
      badge={
        !loadingTodayAvail && availableFriends.length > 0 ? (
          <span className="rounded-full bg-availability-available/10 px-2 py-0.5 text-xs font-medium text-availability-available">
            {availableFriends.length}
          </span>
        ) : undefined
      }
      headerRight={viewAllLink}
    >
      {loadingTodayAvail ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : availableFriends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No friends available today</p>
          <Link to="/friends" className="mt-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs">
              View All Friends
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:border-primary/20 hover:shadow-soft text-left w-full"
              >
                <div
                  onClick={(e) => {
                    if (friend.friendUserId) {
                      e.stopPropagation();
                      navigate(`/friend/${friend.friendUserId}`);
                    }
                  }}
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{friend.name}</p>
                  <p className="text-xs text-availability-available">Free today</p>
                </div>
                <Send className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>

          {connectedFriends.filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId)).length > 4 && (
            <Link to="/friends" className="mt-3 block">
              <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                See {connectedFriends.filter(f => f.friendUserId && todayAvailableFriendIds.has(f.friendUserId)).length - 4} more available
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </>
      )}
    </CollapsibleWidget>

      {/* Quick Hang Request Dialog */}
      <Dialog open={!!selectedFriend} onOpenChange={(open) => !open && setSelectedFriend(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base">
              Hang with {selectedFriend?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {loadingAvail ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableDays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {selectedFriend?.name} has no availability this week
              </p>
            ) : (
              <>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pick a day" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDays.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-sm">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSlot} onValueChange={setSelectedSlot} disabled={!selectedDay}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={selectedDay ? "Pick a time" : "Select a day first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => {
                      const info = TIME_SLOT_LABELS[slot];
                      return (
                        <SelectItem key={slot} value={slot} className="text-sm">
                          {info.label} ({info.time})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Add a message (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none text-sm min-h-[60px]"
                  rows={2}
                />

                <Button
                  onClick={handleSendHangRequest}
                  disabled={!selectedDay || !selectedSlot || sending}
                  className="w-full gap-2"
                  size="sm"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Hang Request
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
