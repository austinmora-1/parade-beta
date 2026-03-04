import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isSameDay, isToday as isDateToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS, TimeSlot, Friend } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, ChevronLeft, ChevronDown, Check } from 'lucide-react';
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
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NewHangRequestDialog({ trigger, open: controlledOpen, onOpenChange }: NewHangRequestDialogProps) {
  const { friends, availabilityMap, plans } = usePlannerStore();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | ''>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [friendAvail, setFriendAvail] = useState<FriendAvailDay[]>([]);
  const [friendPlans, setFriendPlans] = useState<{ date: string; time_slot: string }[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

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

  // Map time slots to hour ranges for default availability calculation
  const TIME_SLOT_HOURS: Record<TimeSlot, { start: number; end: number }> = {
    'early-morning': { start: 6, end: 9 },
    'late-morning': { start: 9, end: 12 },
    'early-afternoon': { start: 12, end: 15 },
    'late-afternoon': { start: 15, end: 18 },
    'evening': { start: 18, end: 22 },
    'late-night': { start: 22, end: 26 },
  };

  const createDefaultSlots = (
    date: Date,
    settings: { workDays: string[]; workStartHour: number; workEndHour: number; defaultStatus: string } | null
  ): Record<TimeSlot, boolean> => {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    const isWorkDay = settings?.workDays?.includes(dayOfWeek) ?? false;
    const defaultFree = settings?.defaultStatus !== 'unavailable';

    const slots: Record<TimeSlot, boolean> = {
      'early-morning': defaultFree,
      'late-morning': defaultFree,
      'early-afternoon': defaultFree,
      'late-afternoon': defaultFree,
      'evening': defaultFree,
      'late-night': defaultFree,
    };

    if (isWorkDay && settings) {
      const workStart = settings.workStartHour;
      const workEnd = settings.workEndHour;
      for (const [slot, hours] of Object.entries(TIME_SLOT_HOURS)) {
        if (hours.start < workEnd && hours.end > workStart) {
          slots[slot as TimeSlot] = false;
        }
      }
    }

    return slots;
  };

  // Fetch friend availability + plans + default settings
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

      const [availResult, plansResult, profileResult] = await Promise.all([
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
        supabase
          .from('profiles')
          .select('default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status')
          .eq('user_id', selectedFriend.friendUserId!)
          .single(),
      ]);

      // Build friend's default settings
      const friendDefaults = profileResult.data ? {
        workDays: (profileResult.data.default_work_days as string[]) || ['monday','tuesday','wednesday','thursday','friday'],
        workStartHour: profileResult.data.default_work_start_hour ?? 9,
        workEndHour: profileResult.data.default_work_end_hour ?? 17,
        defaultStatus: (profileResult.data.default_availability_status as string) || 'free',
      } : null;

      // Map explicit availability records by date
      const availByDate: Record<string, Record<TimeSlot, boolean>> = {};
      if (!availResult.error && availResult.data) {
        for (const row of availResult.data) {
          availByDate[row.date] = Object.fromEntries(
            TIME_SLOT_ORDER.map(slot => [slot, row[SLOT_TO_DB_COL[slot] as keyof typeof row] !== false])
          ) as Record<TimeSlot, boolean>;
        }
      }

      // Build full 7-day availability, filling in defaults for missing days
      const allDays: FriendAvailDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(new Date(), i);
        const dateStr = format(d, 'yyyy-MM-dd');
        allDays.push({
          date: dateStr,
          slots: availByDate[dateStr] || createDefaultSlots(d, friendDefaults),
        });
      }
      setFriendAvail(allDays);

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
    const dayAvail = availabilityMap[format(dayDate, 'yyyy-MM-dd')];
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
    setExpandedDays(new Set());
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const getDaySummary = (dateStr: string) => {
    const bothFree = TIME_SLOT_ORDER.filter(slot => getSlotStatus(dateStr, slot) === 'both-free').length;
    return { bothFree, total: TIME_SLOT_ORDER.length };
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
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden max-h-[85vh] !flex !flex-col">
        <DialogHeader className="p-4 pb-2 shrink-0">
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

        <div className="overflow-y-auto flex-1 min-h-0">
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
            /* Step 2: Availability + request */
            <div className="space-y-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-availability-available" /> Both free
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-availability-available/30" /> They're free
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" /> Unavailable
                </span>
              </div>

              {/* Day cards grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {nextDays.map(day => {
                    const isToday = isDateToday(day.date);
                    const summary = getDaySummary(day.value);
                    const isExpanded = expandedDays.has(day.value);
                    const score = summary.bothFree / summary.total;

                    return (
                      <div key={day.value}>
                        <button
                          onClick={() => toggleDay(day.value)}
                          className={cn(
                            "w-full text-left rounded-lg p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-muted/50",
                            isToday && "bg-primary/5",
                            selectedDay === day.value && "ring-2 ring-primary/30"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={cn("text-xs font-semibold", isToday && "text-primary")}>
                                {day.shortLabel}
                              </span>
                              {isToday && (
                                <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded-full font-medium">
                                  Today
                                </span>
                              )}
                            </div>
                            <ChevronDown className={cn(
                              "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                              isExpanded && "rotate-180"
                            )} />
                          </div>

                          {/* Availability bar */}
                          <div className="mt-1.5 flex gap-0.5">
                            {TIME_SLOT_ORDER.map(slot => {
                              const status = getSlotStatus(day.value, slot);
                              return (
                                <div
                                  key={slot}
                                  className={cn(
                                    "h-1 flex-1 rounded-full",
                                    status === 'both-free' && "bg-availability-available",
                                    status === 'me-busy' && "bg-availability-available/30",
                                    status === 'friend-busy' && "bg-muted-foreground/20",
                                    status === 'both-busy' && "bg-muted-foreground/20"
                                  )}
                                />
                              );
                            })}
                          </div>

                          <div className="mt-1">
                            <span className={cn(
                              "text-[10px] font-medium",
                              score >= 0.5 ? "text-availability-available" : "text-muted-foreground"
                            )}>
                              {summary.bothFree}/{summary.total} mutual
                            </span>
                          </div>
                        </button>

                        {/* Expanded slot list */}
                        {isExpanded && (
                          <div className="space-y-0.5 animate-fade-in px-0.5 pb-1">
                            {TIME_SLOT_ORDER.map(slot => {
                              const status = getSlotStatus(day.value, slot);
                              const isSelected = selectedDay === day.value && selectedSlot === slot;
                              const slotInfo = TIME_SLOT_LABELS[slot];

                              return (
                                <button
                                  key={slot}
                                  onClick={() => {
                                    setSelectedDay(day.value);
                                    setSelectedSlot(slot);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition-colors w-full text-left",
                                    status === 'both-free' && !isSelected && "bg-availability-available/20 text-foreground hover:bg-availability-available/30",
                                    status === 'me-busy' && !isSelected && "bg-availability-available/10 text-foreground hover:bg-availability-available/15",
                                    (status === 'friend-busy' || status === 'both-busy') && "bg-muted/30 text-muted-foreground",
                                    isSelected && "bg-primary text-primary-foreground ring-2 ring-primary"
                                  )}
                                >
                                  <span className={cn(
                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                    status === 'both-free' && !isSelected && "bg-availability-available",
                                    status === 'me-busy' && !isSelected && "bg-availability-available/40",
                                    (status === 'friend-busy' || status === 'both-busy') && "bg-muted-foreground/40",
                                    isSelected && "bg-primary-foreground"
                                  )} />
                                  <span className="font-medium truncate">{slotInfo.label}</span>
                                  <span className={cn(
                                    "ml-auto text-[9px] shrink-0",
                                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                                  )}>
                                    {slotInfo.time}
                                  </span>
                                  {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
