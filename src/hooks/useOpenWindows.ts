import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { TimeSlot, TIME_SLOT_LABELS, Friend } from '@/types/planner';

const SLOT_ORDER: TimeSlot[] = [
  'early-morning',
  'late-morning',
  'early-afternoon',
  'late-afternoon',
  'evening',
  'late-night',
];

// Hours per slot (used to compute block duration)
const SLOT_HOURS: Record<TimeSlot, number> = {
  'early-morning': 3,
  'late-morning': 3,
  'early-afternoon': 3,
  'late-afternoon': 3,
  'evening': 4,
  'late-night': 4,
};

// Cap any window block at this many hours (keeps surface focused on
// short, actionable open windows rather than full-day chunks).
const MAX_WINDOW_HOURS = 3;

const SLOT_DB_KEYS: { key: keyof FriendAvailRow; slot: TimeSlot }[] = [
  { key: 'early_morning', slot: 'early-morning' },
  { key: 'late_morning', slot: 'late-morning' },
  { key: 'early_afternoon', slot: 'early-afternoon' },
  { key: 'late_afternoon', slot: 'late-afternoon' },
  { key: 'evening', slot: 'evening' },
  { key: 'late_night', slot: 'late-night' },
];

interface FriendAvailRow {
  user_id: string;
  date: string;
  early_morning: boolean | null;
  late_morning: boolean | null;
  early_afternoon: boolean | null;
  late_afternoon: boolean | null;
  evening: boolean | null;
  late_night: boolean | null;
  location_status: string | null;
}

export interface OpenWindow {
  date: Date;
  dayLabel: string; // "Today", "Tomorrow", "Saturday"
  slots: TimeSlot[]; // contiguous free slots forming the block
  hours: number;
  startLabel: string; // e.g. "12pm"
  endLabel: string;   // e.g. "9pm"
  overlappingFriends: Array<{
    userId: string;
    name: string;
    avatar?: string;
    overlapHours: number;
  }>;
}

interface MinFriend {
  friendUserId: string;
  name: string;
  avatar?: string;
}

function getTargetDates(): { date: Date; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const saturday = addDays(monday, 5);
  const sunday = addDays(monday, 6);

  const out: { date: Date; label: string }[] = [
    { date: today, label: 'Today' },
    { date: tomorrow, label: 'Tomorrow' },
  ];
  // Add weekend if not already covered
  for (const d of [saturday, sunday]) {
    if (d < today) continue;
    if (isSameDay(d, today) || isSameDay(d, tomorrow)) continue;
    out.push({ date: d, label: format(d, 'EEEE') });
  }
  return out;
}

// Find longest contiguous run of free slots in the day (returns block info)
function findLongestBlock(slotMap: Partial<Record<TimeSlot, boolean>>) {
  let bestRun: TimeSlot[] = [];
  let curRun: TimeSlot[] = [];
  for (const slot of SLOT_ORDER) {
    if (slotMap[slot]) {
      curRun.push(slot);
      if (curRun.length > bestRun.length) bestRun = [...curRun];
    } else {
      curRun = [];
    }
  }
  return bestRun;
}

function blockHours(slots: TimeSlot[]): number {
  return slots.reduce((sum, s) => sum + SLOT_HOURS[s], 0);
}

function slotTimeBounds(slot: TimeSlot): { startHr: number; endHr: number } {
  switch (slot) {
    case 'early-morning': return { startHr: 6, endHr: 9 };
    case 'late-morning': return { startHr: 9, endHr: 12 };
    case 'early-afternoon': return { startHr: 12, endHr: 15 };
    case 'late-afternoon': return { startHr: 15, endHr: 18 };
    case 'evening': return { startHr: 18, endHr: 22 };
    case 'late-night': return { startHr: 22, endHr: 26 };
  }
}

function fmtHour(hr: number): string {
  const h24 = ((hr % 24) + 24) % 24;
  if (h24 === 0) return '12am';
  if (h24 < 12) return `${h24}am`;
  if (h24 === 12) return '12pm';
  return `${h24 - 12}pm`;
}

/**
 * Compute open social "windows" — contiguous 4+ hour blocks of free
 * availability today / tomorrow / this weekend, ranked by friend overlap.
 */
export function useOpenWindows() {
  const { user } = useAuth();
  const { availabilityMap, friends, plans } = usePlannerStore();
  const [friendAvail, setFriendAvail] = useState<FriendAvailRow[]>([]);
  const [loading, setLoading] = useState(true);

  const connectedFriends: MinFriend[] = useMemo(
    () =>
      friends
        .filter((f: Friend) => f.status === 'connected' && f.friendUserId)
        .map((f: Friend) => ({
          friendUserId: f.friendUserId!,
          name: f.name,
          avatar: f.avatar,
        })),
    [friends]
  );

  const targetDates = useMemo(getTargetDates, []);
  const dateStrs = useMemo(() => targetDates.map((d) => format(d.date, 'yyyy-MM-dd')), [targetDates]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id || connectedFriends.length === 0 || dateStrs.length === 0) {
        setFriendAvail([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const friendIds = connectedFriends.map((f) => f.friendUserId);
      const { data } = await supabase
        .from('availability')
        .select(
          'user_id, date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status'
        )
        .in('user_id', friendIds)
        .in('date', dateStrs);
      if (!cancelled) {
        setFriendAvail((data as FriendAvailRow[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, connectedFriends, dateStrs]);

  const windows: OpenWindow[] = useMemo(() => {
    if (!user?.id) return [];
    const result: OpenWindow[] = [];

    for (const { date, label } of targetDates) {
      const dateKey = format(date, 'yyyy-MM-dd');
      const myAvail = availabilityMap[dateKey];

      // Build my free-slot map (true = free), excluding slots where I have a plan
      const slotMap: Partial<Record<TimeSlot, boolean>> = {};
      for (const slot of SLOT_ORDER) {
        const free = myAvail ? !!myAvail.slots[slot] : true;
        const hasPlan = plans.some(
          (p) => isSameDay(p.date, date) && p.timeSlot === slot
        );
        slotMap[slot] = free && !hasPlan;
      }

      const block = findLongestBlock(slotMap);
      const hours = blockHours(block);
      if (hours < 4) continue;

      const { startHr } = slotTimeBounds(block[0]);
      const { endHr } = slotTimeBounds(block[block.length - 1]);

      // Compute friend overlap on the same day
      const overlapping: OpenWindow['overlappingFriends'] = [];
      for (const f of connectedFriends) {
        const row = friendAvail.find(
          (r) => r.user_id === f.friendUserId && r.date === dateKey
        );
        if (!row) continue;
        let overlapHours = 0;
        for (const slot of block) {
          const dbKey = SLOT_DB_KEYS.find((k) => k.slot === slot)!.key;
          if (row[dbKey]) overlapHours += SLOT_HOURS[slot];
        }
        if (overlapHours >= 2) {
          overlapping.push({
            userId: f.friendUserId,
            name: f.name,
            avatar: f.avatar,
            overlapHours,
          });
        }
      }

      // Rank by overlap hours desc
      overlapping.sort((a, b) => b.overlapHours - a.overlapHours);

      result.push({
        date,
        dayLabel: label,
        slots: block,
        hours,
        startLabel: fmtHour(startHr),
        endLabel: fmtHour(endHr),
        overlappingFriends: overlapping.slice(0, 6),
      });
    }

    return result;
  }, [user?.id, targetDates, availabilityMap, plans, connectedFriends, friendAvail]);

  return { windows, loading };
}

export { TIME_SLOT_LABELS };
