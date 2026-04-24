import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay, isToday, isTomorrow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { TimeSlot, TIME_SLOT_LABELS, Friend } from '@/types/planner';
import { isFriendInMyCity } from '@/lib/effectiveCity';

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

// Number of suggested windows surfaced to the user.
const MAX_RESULTS = 5;

// Days to scan ahead (today + next 6 = 1 week).
const SCAN_DAYS = 7;

const DAY_NAMES_LOWER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_SOCIAL_DAYS = ['friday', 'saturday', 'sunday'];
const DEFAULT_SOCIAL_TIMES = ['evening'];

// Onboarding time categories → concrete slots
const TIME_TO_SLOTS: Record<string, TimeSlot[]> = {
  'morning': ['late-morning'],
  'afternoon': ['early-afternoon', 'late-afternoon'],
  'evening': ['evening'],
  'late-night': ['late-night'],
};

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
  trip_location: string | null;
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

function dayLabelFor(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
}

function getTargetDates(): { date: Date; label: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { date: Date; label: string }[] = [];
  for (let i = 0; i < SCAN_DAYS; i++) {
    const d = addDays(today, i);
    out.push({ date: d, label: dayLabelFor(d) });
  }
  return out;
}

// Find all contiguous runs of free slots in the day (each run = a block)
function findAllBlocks(slotMap: Partial<Record<TimeSlot, boolean>>): TimeSlot[][] {
  const runs: TimeSlot[][] = [];
  let curRun: TimeSlot[] = [];
  for (const slot of SLOT_ORDER) {
    if (slotMap[slot]) {
      curRun.push(slot);
    } else {
      if (curRun.length) runs.push(curRun);
      curRun = [];
    }
  }
  if (curRun.length) runs.push(curRun);
  return runs;
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
 * Score how well a (date, slot) matches the user's stated preferences.
 * Higher = better fit. 0 = no match.
 */
function preferenceScore(
  date: Date,
  slot: TimeSlot,
  prefDays: string[],
  prefTimes: string[],
): number {
  const dayName = DAY_NAMES_LOWER[date.getDay()];
  let score = 0;

  // Day-specific slot ("day:slot" or any "*:slot") match — strongest signal
  const daySlotMatch = prefTimes.some(
    (t) => t === `${dayName}:${slot}` || t.endsWith(`:${slot}`)
  );
  if (daySlotMatch) score += 3;

  // General day preference
  const validDays = prefDays.filter((d) => DAY_NAMES_LOWER.includes(d));
  if (validDays.length === 0 || validDays.includes(dayName)) score += 1;

  // General time-of-day preference
  const bareTimes = prefTimes.filter((t) => !t.includes(':'));
  for (const bt of bareTimes) {
    const mapped = TIME_TO_SLOTS[bt];
    if (mapped?.includes(slot)) { score += 2; break; }
  }

  return score;
}

/**
 * Compute the user's top recommended open windows for the coming week,
 * prioritized by their preferred social days/times and friend overlap.
 */
export function useOpenWindows() {
  const { user } = useAuth();
  const { availabilityMap, friends, plans, homeAddress } = usePlannerStore();
  const [friendAvail, setFriendAvail] = useState<FriendAvailRow[]>([]);
  const [friendHomeAddresses, setFriendHomeAddresses] = useState<Record<string, string | null>>({});
  const [prefDays, setPrefDays] = useState<string[]>(DEFAULT_SOCIAL_DAYS);
  const [prefTimes, setPrefTimes] = useState<string[]>(DEFAULT_SOCIAL_TIMES);
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

  // Load the current user's social preferences once.
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('preferred_social_days, preferred_social_times')
        .eq('user_id', user.id)
        .single();
      if (cancelled || !data) return;
      const days = (data as { preferred_social_days: string[] | null }).preferred_social_days;
      const times = (data as { preferred_social_times: string[] | null }).preferred_social_times;
      if (days && days.length) setPrefDays(days);
      if (times && times.length) setPrefTimes(times);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id || connectedFriends.length === 0 || dateStrs.length === 0) {
        setFriendAvail([]);
        setFriendHomeAddresses({});
        setLoading(false);
        return;
      }
      setLoading(true);
      const friendIds = connectedFriends.map((f) => f.friendUserId);
      const [availRes, profilesRes] = await Promise.all([
        supabase
          .from('availability')
          .select(
            'user_id, date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location'
          )
          .in('user_id', friendIds)
          .in('date', dateStrs),
        supabase
          .from('profiles')
          .select('user_id, home_address')
          .in('user_id', friendIds),
      ]);
      if (!cancelled) {
        setFriendAvail((availRes.data as FriendAvailRow[]) || []);
        const map: Record<string, string | null> = {};
        for (const p of (profilesRes.data as { user_id: string; home_address: string | null }[]) || []) {
          map[p.user_id] = p.home_address;
        }
        setFriendHomeAddresses(map);
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
    type Scored = OpenWindow & { _score: number };
    const candidates: Scored[] = [];

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

      const allBlocks = findAllBlocks(slotMap);
      if (allBlocks.length === 0) continue;

      for (const fullBlock of allBlocks) {
        // Walk the contiguous free run and create up to one window per
        // distinct anchor slot, starting from each slot that scores >0
        // against the user's preferences. This lets a single long free
        // stretch surface multiple distinct suggestions (e.g. afternoon +
        // evening on a Saturday).
        for (let startIdx = 0; startIdx < fullBlock.length; startIdx++) {
          const anchor = fullBlock[startIdx];
          const anchorScore = preferenceScore(date, anchor, prefDays, prefTimes);
          if (anchorScore === 0) continue;

          // Build the block from the anchor forward, capped at MAX_WINDOW_HOURS.
          const block: TimeSlot[] = [];
          let runningHours = 0;
          let totalScore = 0;
          for (let j = startIdx; j < fullBlock.length; j++) {
            const slot = fullBlock[j];
            const next = runningHours + SLOT_HOURS[slot];
            if (next > MAX_WINDOW_HOURS && block.length > 0) break;
            block.push(slot);
            runningHours = next;
            totalScore += preferenceScore(date, slot, prefDays, prefTimes);
            if (runningHours >= MAX_WINDOW_HOURS) break;
          }
          const hours = Math.min(blockHours(block), MAX_WINDOW_HOURS);
          if (hours < 2) continue;

          const { startHr } = slotTimeBounds(block[0]);
          const rawEndHr = slotTimeBounds(block[block.length - 1]).endHr;
          const endHr = Math.min(rawEndHr, startHr + hours);

          // Build my availability row for this date (for trip_location/location_status)
          const myRowForCity = {
            date: dateKey,
            location_status: myAvail?.locationStatus || 'home',
            trip_location: myAvail?.tripLocation || null,
          };

          // Friend overlap on this block — only co-located friends.
          const overlapping: OpenWindow['overlappingFriends'] = [];
          for (const f of connectedFriends) {
            const row = friendAvail.find(
              (r) => r.user_id === f.friendUserId && r.date === dateKey
            );
            if (!row) continue;

            const sameCity = isFriendInMyCity({
              date,
              myAvailability: myRowForCity,
              myHomeAddress: homeAddress,
              friendAvailability: row,
              friendHomeAddress: friendHomeAddresses[f.friendUserId] ?? null,
            });
            if (!sameCity) continue;

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
                overlapHours: Math.min(overlapHours, MAX_WINDOW_HOURS),
              });
            }
          }
          overlapping.sort((a, b) => b.overlapHours - a.overlapHours);

          // Composite score: preference fit + friend overlap + soonness.
          const overlapBonus = overlapping.reduce((s, o) => s + o.overlapHours, 0);
          const daysAway = Math.max(
            0,
            Math.round((date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
          );
          const soonness = (SCAN_DAYS - daysAway) * 0.25;
          const score = totalScore * 2 + overlapBonus + soonness;

          candidates.push({
            date,
            dayLabel: label,
            slots: block,
            hours,
            startLabel: fmtHour(startHr),
            endLabel: fmtHour(endHr),
            overlappingFriends: overlapping.slice(0, 6),
            _score: score,
          });
        }
      }
    }

    // Deduplicate windows that share the same date + starting slot.
    const seen = new Set<string>();
    const deduped: Scored[] = [];
    candidates
      .sort((a, b) => b._score - a._score)
      .forEach((c) => {
        const key = `${format(c.date, 'yyyy-MM-dd')}|${c.slots[0]}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(c);
      });

    return deduped.slice(0, MAX_RESULTS).map(({ _score, ...w }) => w);
  }, [user?.id, targetDates, availabilityMap, plans, connectedFriends, friendAvail, friendHomeAddresses, homeAddress, prefDays, prefTimes]);

  return { windows, loading };
}

export { TIME_SLOT_LABELS };
