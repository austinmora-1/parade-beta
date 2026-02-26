import { useState, useMemo, useEffect } from 'react';
import { Friend, TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, CalendarPlus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { useNavigate } from 'react-router-dom';

interface GroupSchedulerProps {
  friends: Friend[];
}

interface FriendAvailability {
  userId: string;
  slots: Record<string, Record<TimeSlot, boolean>>;
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

export function GroupScheduler({ friends }: GroupSchedulerProps) {
  const connectedFriends = friends.filter(f => f.status === 'connected');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [friendAvailabilities, setFriendAvailabilities] = useState<FriendAvailability[]>([]);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; slot: TimeSlot } | null>(null);
  const { availability: myAvailability, plans } = usePlannerStore();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Fetch availability for selected friends
  useEffect(() => {
    if (selectedFriends.length === 0) {
      setFriendAvailabilities([]);
      return;
    }

    const fetchAvail = async () => {
      const userIds = selectedFriends.map(f => f.friendUserId).filter(Boolean) as string[];
      if (userIds.length === 0) return;

      const startDate = format(days[0], 'yyyy-MM-dd');
      const endDate = format(days[6], 'yyyy-MM-dd');

      const { data } = await supabase
        .from('availability')
        .select('*')
        .in('user_id', userIds)
        .gte('date', startDate)
        .lte('date', endDate);

      const avails: FriendAvailability[] = userIds.map(uid => {
        const userRows = (data || []).filter(d => d.user_id === uid);
        const slots: Record<string, Record<TimeSlot, boolean>> = {};
        for (const row of userRows) {
          slots[row.date] = {
            'early-morning': row.early_morning ?? true,
            'late-morning': row.late_morning ?? true,
            'early-afternoon': row.early_afternoon ?? true,
            'late-afternoon': row.late_afternoon ?? true,
            'evening': row.evening ?? true,
            'late-night': row.late_night ?? true,
          };
        }
        return { userId: uid, slots };
      });

      setFriendAvailabilities(avails);
    };

    fetchAvail();
  }, [selectedFriends, days]);

  const toggleFriend = (friend: Friend) => {
    setSelectedFriends(prev =>
      prev.find(f => f.id === friend.id)
        ? prev.filter(f => f.id !== friend.id)
        : [...prev, friend]
    );
  };

  // Get combined availability status for a day/slot
  const getOverlapStatus = (date: Date, slot: TimeSlot): 'all-free' | 'some-free' | 'none-free' | 'no-data' => {
    if (selectedFriends.length === 0) return 'no-data';

    const dateStr = format(date, 'yyyy-MM-dd');

    // Check my availability
    const myDay = myAvailability.find(a => isSameDay(a.date, date));
    const myFree = myDay ? myDay.slots[slot] : true;
    const myBusy = plans.some(p => isSameDay(p.date, date) && p.timeSlot === slot);

    // Check friends' availability
    let freeCount = 0;
    let totalChecked = 0;

    for (const fa of friendAvailabilities) {
      totalChecked++;
      const daySlots = fa.slots[dateStr];
      if (!daySlots || daySlots[slot]) freeCount++;
    }

    const iAmFree = myFree && !myBusy;
    const allFriendsFree = freeCount === totalChecked;
    const someFriendsFree = freeCount > 0;

    if (iAmFree && allFriendsFree) return 'all-free';
    if (iAmFree && someFriendsFree) return 'some-free';
    if (!iAmFree) return 'none-free';
    return 'none-free';
  };

  const handleSlotClick = (date: Date, slot: TimeSlot) => {
    const status = getOverlapStatus(date, slot);
    if (status === 'none-free') return;
    setSelectedSlot({ date, slot });
    setCreatePlanOpen(true);
  };

  if (connectedFriends.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-soft md:p-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
        <Users className="h-4 w-4 text-primary" />
        Schedule a Hang
      </h2>

      {/* Friend selector chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {connectedFriends.map(friend => {
          const isSelected = selectedFriends.some(f => f.id === friend.id);
          return (
            <button
              key={friend.id}
              onClick={() => toggleFriend(friend)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={friend.avatar} />
                <AvatarFallback className={cn("text-[8px]", getAvatarColor(friend.name))}>
                  {getInitials(friend.name)}
                </AvatarFallback>
              </Avatar>
              {friend.name.split(' ')[0]}
              {isSelected && <X className="h-3 w-3 ml-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Availability overlay grid */}
      {selectedFriends.length > 0 && (
        <div className="space-y-2">
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {format(days[0], 'MMM d')} – {format(days[6], 'MMM d')}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="w-16 p-1 text-left text-muted-foreground font-normal" />
                  {days.map(day => (
                    <th key={day.toISOString()} className={cn(
                      "p-1 text-center font-medium min-w-[40px]",
                      isToday(day) && "text-primary"
                    )}>
                      <div>{format(day, 'EEE')}</div>
                      <div className={cn("text-sm", isToday(day) && "font-bold")}>{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map(slot => (
                  <tr key={slot}>
                    <td className="p-1 text-muted-foreground whitespace-nowrap">
                      {TIME_SLOT_LABELS[slot].time}
                    </td>
                    {days.map(day => {
                      const status = getOverlapStatus(day, slot);
                      return (
                        <td key={day.toISOString()} className="p-0.5">
                          <button
                            onClick={() => handleSlotClick(day, slot)}
                            disabled={status === 'none-free' || status === 'no-data'}
                            className={cn(
                              "w-full h-6 rounded transition-all text-[9px] font-medium",
                              status === 'all-free' && "bg-availability-available/30 hover:bg-availability-available/50 text-availability-available cursor-pointer",
                              status === 'some-free' && "bg-availability-partial/20 hover:bg-availability-partial/30 text-availability-partial cursor-pointer",
                              status === 'none-free' && "bg-muted/40 text-muted-foreground/40 cursor-not-allowed",
                              status === 'no-data' && "bg-transparent"
                            )}
                          >
                            {status === 'all-free' && '✓'}
                            {status === 'some-free' && '~'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-availability-available/30" />
              All free
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-availability-partial/20" />
              Some free
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
              Unavailable
            </div>
          </div>

          {/* Create plan button */}
          <Button
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => {
              setSelectedSlot(null);
              setCreatePlanOpen(true);
            }}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Create Plan with {selectedFriends.length} {selectedFriends.length === 1 ? 'friend' : 'friends'}
          </Button>
        </div>
      )}

      <CreatePlanDialog
        open={createPlanOpen}
        onOpenChange={setCreatePlanOpen}
        defaultDate={selectedSlot?.date}
      />
    </div>
  );
}
