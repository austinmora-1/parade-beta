import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, Friend } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, ChevronLeft, Users, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface FriendAvailDay {
  date: string;
  slots: Record<TimeSlot, boolean>;
}

interface NewHangRequestDialogProps {
  trigger: React.ReactNode;
}

export function NewHangRequestDialog({ trigger }: NewHangRequestDialogProps) {
  const { friends, availability, plans } = usePlannerStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | ''>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [friendAvail, setFriendAvail] = useState<FriendAvailDay[]>([]);
  const [friendPlans, setFriendPlans] = useState<{ date: string; time_slot: string }[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const connectedFriends = useMemo(() => {
    return friends.filter(f => f.status === 'connected' && f.friendUserId);
  }, [friends]);

  // Next 7 days
  const nextDays = useMemo(() => {
    const days: { value: string; label: string; shortLabel: string; date: Date }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      days.push({
        value: format(d, 'yyyy-MM-dd'),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEE, MMM d'),
        shortLabel: i === 0 ? 'Today' : format(d, 'EEE d'),
        date: d,
      });
    }
    return days;
  }, []);

  // Fetch friend availability + plans
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

  // Get user's own slot status for a given date/slot
  const getMySlotStatus = (dateStr: string, slot: TimeSlot): 'free' | 'busy' => {
    const dayDate = nextDays.find(d => d.value === dateStr)?.date;
    if (!dayDate) return 'free';

    // Check plans
    const hasPlan = plans.some(
      p => isSameDay(p.date, dayDate) && p.timeSlot === slot && p.myRole !== 'subscriber'
    );
    if (hasPlan) return 'busy';

    // Check availability
    const dayAvail = availability.find(a => isSameDay(a.date, dayDate));
    if (dayAvail && !dayAvail.slots[slot]) return 'busy';

    return 'free';
  };

  // Get friend's slot status
  const getFriendSlotStatus = (dateStr: string, slot: TimeSlot): 'free' | 'busy' => {
    const hasPlan = friendPlans.some(p => p.date === dateStr && p.time_slot === slot);
    if (hasPlan) return 'busy';

    const avail = friendAvail.find(a => a.date === dateStr);
    if (avail && !avail.slots[slot]) return 'busy';

    return 'free';
  };

  // Combined status
  const getSlotStatus = (dateStr: string, slot: TimeSlot): 'both-free' | 'friend-busy' | 'me-busy' | 'both-busy' => {
    const myStatus = getMySlotStatus(dateStr, slot);
    const friendStatus = getFriendSlotStatus(dateStr, slot);

    if (myStatus === 'free' && friendStatus === 'free') return 'both-free';
    if (myStatus === 'busy' && friendStatus === 'busy') return 'both-busy';
    if (friendStatus === 'busy') return 'friend-busy';
    return 'me-busy';
  };

  const handleSendHangRequest = async () => {
    if (!selectedFriend || !selectedDay || !selectedSlot || !user) return;

    setSending(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('share_code')
        .eq('user_id', selectedFriend.friendUserId!)
        .single();

      if (!profile?.share_code) {
        toast.error("Could not find friend's profile");
        setSending(false);
        return;
      }

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
      resetAndClose();
    } catch (err: any) {
      console.error('Error sending hang request:', err);
      toast.error(err.message || 'Failed to send hang request');
    } finally {
      setSending(false);
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setSelectedFriend(null);
    setSelectedDay('');
    setSelectedSlot('');
    setMessage('');
  };

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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center gap-2">
            {selectedFriend && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 -ml-1"
                onClick={() => {
                  setSelectedFriend(null);
                  setSelectedDay('');
                  setSelectedSlot('');
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-base">
              {selectedFriend ? `Hang with ${selectedFriend.name}` : 'New Hang Request'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-4 pb-4">
          {!selectedFriend ? (
            /* Step 1: Friend selector */
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Pick a friend to hang with</p>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {connectedFriends.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No connected friends yet
                    </p>
                  ) : (
                    connectedFriends.map(friend => (
                      <button
                        key={friend.id}
                        onClick={() => setSelectedFriend(friend)}
                        className="flex items-center gap-3 w-full rounded-lg p-2.5 transition-all hover:bg-muted/50 text-left"
                      >
                        <div className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          getAvatarColor(friend.name)
                        )}>
                          {friend.avatar ? (
                            <img src={friend.avatar} alt={friend.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            getInitials(friend.name)
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{friend.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : loadingAvail ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            /* Step 2: Availability grid + request */
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-availability-available/60" /> Both free
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-400/40" /> You're busy
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-muted" /> They're busy
                </span>
              </div>

              {/* Availability grid */}
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(6,1fr)] bg-muted/30 border-b border-border">
                  <div className="p-1.5 text-[10px] font-medium text-muted-foreground" />
                  {TIME_SLOT_ORDER.map(slot => (
                    <div key={slot} className="p-1 text-center">
                      <span className="text-[9px] font-medium text-muted-foreground leading-tight block">
                        {TIME_SLOT_LABELS[slot].time}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {nextDays.map(day => (
                  <div
                    key={day.value}
                    className={cn(
                      "grid grid-cols-[80px_repeat(6,1fr)] border-b border-border last:border-b-0",
                      selectedDay === day.value && "bg-primary/5"
                    )}
                  >
                    <div className="p-1.5 flex items-center">
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {day.shortLabel}
                      </span>
                    </div>
                    {TIME_SLOT_ORDER.map(slot => {
                      const status = getSlotStatus(day.value, slot);
                      const isSelected = selectedDay === day.value && selectedSlot === slot;
                      const canSelect = status === 'both-free' || status === 'me-busy';

                      return (
                        <button
                          key={slot}
                          onClick={() => {
                            if (!canSelect) return;
                            setSelectedDay(day.value);
                            setSelectedSlot(slot);
                          }}
                          disabled={!canSelect}
                          className={cn(
                            "p-1 flex items-center justify-center transition-all min-h-[32px]",
                            status === 'both-free' && !isSelected && "bg-availability-available/15 hover:bg-availability-available/30",
                            status === 'me-busy' && !isSelected && "bg-amber-400/15 hover:bg-amber-400/25",
                            status === 'friend-busy' && "bg-muted/40 cursor-not-allowed",
                            status === 'both-busy' && "bg-muted/60 cursor-not-allowed",
                            isSelected && "bg-primary ring-2 ring-primary ring-inset"
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Message + Send */}
              <Textarea
                placeholder="Add a message (optional)"
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="resize-none text-sm min-h-[50px]"
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
                {selectedDay && selectedSlot && (
                  <span className="text-xs opacity-80">
                    · {nextDays.find(d => d.value === selectedDay)?.shortLabel} {TIME_SLOT_LABELS[selectedSlot as TimeSlot]?.time}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
