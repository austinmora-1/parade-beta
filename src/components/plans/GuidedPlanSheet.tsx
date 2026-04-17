import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus, Loader2, ArrowLeft, Sparkles, CalendarDays, Check, MapPin, Search, Plus, CircleHelp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, VIBE_CONFIG, TimeSlot, ActivityType, VibeType, getActivitiesByVibe, getAllVibes, CustomActivity } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCity, citiesMatch } from '@/lib/locationMatch';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { SlotCalendarPicker, SelectedSlotEntry } from '@/components/plans/SlotCalendarPicker';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useAuth } from '@/hooks/useAuth';

interface GuidedPlanSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedFriends: { userId: string; name: string; avatar?: string }[];
}

type Step = 'friends' | 'activity' | 'time' | 'confirm';

const TBD_ACTIVITY_ID = 'tbd';
const TBD_EMOJI = '❓';
const TBD_LABEL = 'TBD';

interface BestSlot {
  date: Date;
  slot: TimeSlot;
  status: 'all-free' | 'some-free';
  freeCount: number;
  total: number;
  sharedCity: string;
}

const SLOT_LABELS: Record<string, string> = {
  'late-morning': 'Morning',
  'early-afternoon': 'Lunch',
  'late-afternoon': 'Afternoon',
  'evening': 'Evening',
  'late-night': 'Late Night',
};


function SlotCard({ bs, i, onSelect, isSelected }: { bs: BestSlot; i: number; onSelect: (bs: BestSlot) => void; isSelected?: boolean }) {
  const dayLabel = isSameDay(bs.date, new Date())
    ? 'Today'
    : isSameDay(bs.date, addDays(new Date(), 1))
      ? 'Tomorrow'
      : format(bs.date, 'EEEE, MMM d');

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08 }}
      onClick={() => onSelect(bs)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : bs.status === 'all-free'
            ? "border-availability-available/40 bg-availability-available/5 hover:bg-availability-available/10"
            : "border-border hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      {/* Selection indicator */}
      <div className={cn(
        "flex items-center justify-center h-5 w-5 rounded-full border-2 shrink-0 transition-all",
        isSelected
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/30"
      )}>
        {isSelected && <Check className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{SLOT_LABELS[bs.slot]}</p>
          {bs.sharedCity && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80">
              <MapPin className="h-2.5 w-2.5" />
              {bs.sharedCity}
            </span>
          )}
        </div>
      </div>
      {bs.status === 'all-free' && bs.total > 0 ? (
        <span className="text-[10px] font-medium text-availability-available bg-availability-available/10 rounded-full px-2 py-0.5 shrink-0">
          Everyone's free ✓
        </span>
      ) : bs.total > 0 ? (
        <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
          {bs.freeCount}/{bs.total} free
        </span>
      ) : null}
    </motion.button>
  );
}

export function GuidedPlanSheet({ open, onOpenChange, preSelectedFriends }: GuidedPlanSheetProps) {
  const { session } = useAuth();
  const { proposePlan, friends, userId, availabilityMap: myAvailabilityMap, plans: myPlans, homeAddress } = usePlannerStore();
  const viewport = useVisualViewport();

  const needsFriendStep = preSelectedFriends.length === 0;
  const [chosenFriends, setChosenFriends] = useState<{ userId: string; name: string; avatar?: string }[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [soloMode, setSoloMode] = useState(false);

  // The effective friends list (pre-selected or user-chosen)
  const effectiveFriends = soloMode ? [] : (needsFriendStep ? chosenFriends : preSelectedFriends);
  const hasFriends = effectiveFriends.length > 0;

  const [step, setStep] = useState<Step>(needsFriendStep ? 'friends' : 'activity');
  const [activity, setActivity] = useState<ActivityType | string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlot, setTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlotEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [bestSlots, setBestSlots] = useState<BestSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [friendMultiDayAvail, setFriendMultiDayAvail] = useState<Record<string, Record<TimeSlot, { free: number; total: number }>>>({});
  const [selectedSharedCity, setSelectedSharedCity] = useState<string>('');
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✨');
  const [activitySearch, setActivitySearch] = useState('');

  const friendNames = effectiveFriends.map(f => f.name.split(' ')[0]);
  const friendNamesStr = friendNames.length <= 2 ? friendNames.join(' & ') : `${friendNames.slice(0, -1).join(', ')} & ${friendNames[friendNames.length - 1]}`;

  // Connected friends for the selection step
  const connectedFriends = useMemo(() =>
    friends.filter(f => f.status === 'connected' && f.friendUserId),
    [friends]
  );

  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return connectedFriends;
    const q = friendSearch.toLowerCase();
    return connectedFriends.filter(f => f.name.toLowerCase().includes(q));
  }, [connectedFriends, friendSearch]);

  const toggleFriend = (f: typeof connectedFriends[0]) => {
    setChosenFriends(prev => {
      const exists = prev.some(p => p.userId === f.friendUserId);
      if (exists) return prev.filter(p => p.userId !== f.friendUserId);
      return [...prev, { userId: f.friendUserId!, name: f.name, avatar: f.avatar }];
    });
  };

  // Load custom activities from profile
  useEffect(() => {
    if (!session?.user) return;
    supabase.from('profiles').select('custom_activities').eq('user_id', session.user.id).single()
      .then(({ data }) => {
        if (data?.custom_activities) {
          setCustomActivities(data.custom_activities as unknown as CustomActivity[]);
        }
      });
  }, [session?.user]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(needsFriendStep ? 'friends' : 'activity');
      setActivity(null);
      setSelectedDate(null);
      setTimeSlot(null);
      setSelectedSlots([]);
      setSending(false);
      setBestSlots([]);
      setShowCalendar(false);
      setFriendMultiDayAvail({});
      setChosenFriends([]);
      setFriendSearch('');
      setSoloMode(false);
      setShowCustomInput(false);
      setCustomLabel('');
      setActivitySearch('');
    }
  }, [open, needsFriendStep]);

  // Fetch availability + best slots when moving to time step (only when friends selected)
  const fetchBestSlots = useCallback(async () => {
    if (effectiveFriends.length === 0) { setLoadingSlots(false); return; }
    setLoadingSlots(true);

    const userIds = effectiveFriends.map(f => f.userId);
    const scanDays = Array.from({ length: 180 }, (_, i) => addDays(new Date(), i));
    const startDate = format(scanDays[0], 'yyyy-MM-dd');
    const endDate = format(scanDays[179], 'yyyy-MM-dd');

    const allUserIds = userId ? [...userIds, userId] : userIds;
    const [
      { data: availData },
      { data: ownPlansData },
      { data: friendProfiles },
      { data: tripsData },
      { data: participatedPlansData },
    ] = await Promise.all([
      supabase.from('availability').select('*').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate),
      supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      supabase.from('friend_profiles').select('user_id, home_address, default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status, preferred_social_days, preferred_social_times').in('user_id', allUserIds),
      supabase.from('trips').select('user_id, location, start_date, end_date').in('user_id', allUserIds).gte('end_date', startDate).lte('start_date', endDate),
      // Fetch plans where friends are participants (not owners) to check busy times
      supabase.from('plan_participants').select('friend_id, plan_id, status, plans!inner(date, time_slot, status)').in('friend_id', allUserIds).in('status', ['accepted', 'invited']),
    ]);

    // Build profile map
    const profileMap = new Map<string, {
      homeAddress: string | null;
      defaultWorkDays: string[];
      defaultWorkStartHour: number;
      defaultWorkEndHour: number;
      defaultAvailStatus: string;
      preferredSocialDays: string[];
      preferredSocialTimes: string[];
    }>();
    for (const p of (friendProfiles || [])) {
      profileMap.set(p.user_id, {
        homeAddress: p.home_address,
        defaultWorkDays: (p.default_work_days as string[]) || ['monday','tuesday','wednesday','thursday','friday'],
        defaultWorkStartHour: (p.default_work_start_hour as number) ?? 9,
        defaultWorkEndHour: (p.default_work_end_hour as number) ?? 17,
        defaultAvailStatus: (p.default_availability_status as string) || 'free',
        preferredSocialDays: (p.preferred_social_days as string[]) || [],
        preferredSocialTimes: (p.preferred_social_times as string[]) || [],
      });
    }
    // Also add current user's profile from store or fetched data
    if (userId && !profileMap.has(userId)) {
      profileMap.set(userId, {
        homeAddress: homeAddress || null,
        defaultWorkDays: ['monday','tuesday','wednesday','thursday','friday'],
        defaultWorkStartHour: 9,
        defaultWorkEndHour: 17,
        defaultAvailStatus: 'free',
        preferredSocialDays: [],
        preferredSocialTimes: [],
      });
    }

    // Build trip lookup: for a given userId + date, find ALL trip locations
    const tripsByUser = new Map<string, { location: string; start_date: string; end_date: string }[]>();
    for (const t of (tripsData || [])) {
      if (!tripsByUser.has(t.user_id)) tripsByUser.set(t.user_id, []);
      tripsByUser.get(t.user_id)!.push(t);
    }
    function getAllTripCitiesForDate(uid: string, dateStr: string): string[] {
      const trips = tripsByUser.get(uid);
      if (!trips) return [];
      const cities: string[] = [];
      for (const t of trips) {
        if (dateStr >= t.start_date && dateStr <= t.end_date && t.location) {
          const city = normalizeCity(t.location);
          if (city) cities.push(city);
        }
      }
      return cities;
    }

    // Resolve all possible cities for a user on a given date
    function getUserCitiesForDate(uid: string, dateStr: string, availRow: any): string[] {
      const profile = profileMap.get(uid);
      const cities = new Set<string>();

      // From availability record trip_location
      if (availRow?.trip_location) {
        const city = normalizeCity(availRow.trip_location);
        if (city) cities.add(city);
      }

      // From ALL trips covering this date (canonical source)
      for (const city of getAllTripCitiesForDate(uid, dateStr)) {
        cities.add(city);
      }

      // If no away indicators found, use home address
      const isAway = cities.size > 0 || availRow?.location_status === 'away';
      if (!isAway && profile?.homeAddress) {
        const city = normalizeCity(profile.homeAddress);
        if (city) cities.add(city);
      }

      return Array.from(cities);
    }

    // Find first shared city between two sets
    function findSharedCity(citiesA: string[], citiesB: string[]): string | null {
      for (const a of citiesA) {
        for (const b of citiesB) {
          if (citiesMatch(a, b)) return a;
        }
      }
      return null;
    }

    // Slot → approximate hour range for work-hour checking
    const SLOT_HOURS: Record<string, [number, number]> = {
      'early-morning': [6, 9],
      'late-morning': [9, 12],
      'early-afternoon': [12, 15],
      'late-afternoon': [15, 18],
      'evening': [18, 21],
      'late-night': [21, 24],
    };

    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Get default slot availability when no explicit row exists
    function getDefaultSlotFree(uid: string, date: Date, slot: string): boolean {
      const profile = profileMap.get(uid);
      if (!profile) return false; // Unknown user → not free
      if (profile.defaultAvailStatus === 'unavailable') return false;

      // Check if it's a work day
      const dayName = DAY_NAMES[date.getDay()];
      const isWorkDay = profile.defaultWorkDays.includes(dayName);
      if (!isWorkDay) return true; // Non-work days are free

      // Check if slot overlaps with work hours
      const [slotStart, slotEnd] = SLOT_HOURS[slot] || [0, 0];
      const workStart = profile.defaultWorkStartHour;
      const workEnd = profile.defaultWorkEndHour;
      // Slot is busy if it overlaps work hours
      if (slotStart < workEnd && slotEnd > workStart) return false;
      return true;
    }

    const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const results: BestSlot[] = [];
    const multiDay: typeof friendMultiDayAvail = {};

    // Index availability by "userId:date" for O(1) lookup
    const availIndex = new Map<string, (typeof availData extends (infer T)[] | null ? T : never)>();
    for (const a of (availData || [])) {
      availIndex.set(`${a.user_id}:${a.date}`, a);
    }

    // Index plans (owned) by "userId:date" → set of busy slots
    const planIndex = new Map<string, Set<string>>();
    for (const p of (ownPlansData || [])) {
      const key = `${p.user_id}:${p.date?.slice(0, 10)}`;
      if (!planIndex.has(key)) planIndex.set(key, new Set());
      planIndex.get(key)!.add(p.time_slot);
    }

    // Index participated plans by "userId:date" → set of busy slots
    for (const pp of (participatedPlansData || [])) {
      const plan = (pp as any).plans;
      if (!plan || plan.status === 'cancelled' || plan.status === 'declined') continue;
      const dateStr = plan.date?.slice(0, 10);
      if (!dateStr) continue;
      const key = `${pp.friend_id}:${dateStr}`;
      if (!planIndex.has(key)) planIndex.set(key, new Set());
      planIndex.get(key)!.add(plan.time_slot);
    }

    for (const day of scanDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const slotMap = {} as Record<TimeSlot, { free: number; total: number }>;

      // Resolve my cities for this date
      const myRow = userId ? availIndex.get(`${userId}:${dateStr}`) : undefined;
      const myCities = userId ? getUserCitiesForDate(userId, dateStr, myRow) : [];

      // Skip if I have no resolvable location
      if (myCities.length === 0) {
        for (const slot of allSlots) slotMap[slot] = { free: 0, total: userIds.length };
        multiDay[dateStr] = slotMap;
        continue;
      }

      // Get my availability from store or fetched data
      let myDay = myAvailabilityMap[dateStr];
      if (!myDay && myRow) {
        myDay = {
          date: day,
          slots: {
            'early-morning': myRow.early_morning ?? true,
            'late-morning': myRow.late_morning ?? true,
            'early-afternoon': myRow.early_afternoon ?? true,
            'late-afternoon': myRow.late_afternoon ?? true,
            'evening': myRow.evening ?? true,
            'late-night': myRow.late_night ?? true,
          },
          locationStatus: (myRow.location_status as any) || 'home',
          tripLocation: myRow.trip_location || undefined,
        };
      }

      // My plan busy slots
      const myPlanSlots = userId ? planIndex.get(`${userId}:${dateStr}`) : undefined;

      for (const slot of allSlots) {
        // My availability: use explicit row, or profile defaults
        const myFree = myDay ? myDay.slots[slot] : (userId ? getDefaultSlotFree(userId, day, slot) : true);
        const myBusy = myPlanSlots?.has(slot) || false;
        const iAmFree = myFree && !myBusy;

        let freeCount = 0;
        for (const uid of userIds) {
          const row = availIndex.get(`${uid}:${dateStr}`);

          // Co-location check: resolve friend's cities and find intersection with mine
          const friendCities = getUserCitiesForDate(uid, dateStr, row);
          const sharedCity = findSharedCity(myCities, friendCities);
          if (!sharedCity) continue; // Not co-located, skip

          // Friend availability: use explicit row, or profile defaults
          const colName = slot.replace(/-/g, '_') as string;
          const isAvailable = row ? ((row as any)[colName] ?? true) : getDefaultSlotFree(uid, day, slot);

          // Friend busy check: owned plans + participated plans
          const hasPlan = planIndex.get(`${uid}:${dateStr}`)?.has(slot) || false;

          if (isAvailable && !hasPlan) freeCount++;
        }
        slotMap[slot] = { free: freeCount, total: userIds.length };

        if (iAmFree && freeCount > 0) {
          // Find the shared city for display
          const friendCities = getUserCitiesForDate(userIds[0], dateStr, availIndex.get(`${userIds[0]}:${dateStr}`));
          const rawCity = findSharedCity(myCities, friendCities) || '';
          const sharedCity = rawCity ? rawCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
          results.push({
            date: day,
            slot,
            status: freeCount === userIds.length ? 'all-free' : 'some-free',
            freeCount,
            total: userIds.length,
            sharedCity,
          });
        }
      }
      multiDay[dateStr] = slotMap;
    }

    setFriendMultiDayAvail(multiDay);

    // --- Social preference scoring ---
    // For each participant, check if the slot matches their preferred social days/times.
    // Default to weekend evening (Fri/Sat/Sun evening) if no preferences defined.
    const DEFAULT_SOCIAL_DAYS = ['friday', 'saturday', 'sunday'];
    const DEFAULT_SOCIAL_TIMES = ['evening'];
    const DAY_NAMES_LOWER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    function getSocialPreferenceScore(date: Date, slot: string): number {
      const dayName = DAY_NAMES_LOWER[date.getDay()];
      let totalScore = 0;
      const participantIds = userId ? [userId, ...userIds] : userIds;

      for (const uid of participantIds) {
        const profile = profileMap.get(uid);
        const prefDays = profile?.preferredSocialDays?.length ? profile.preferredSocialDays : DEFAULT_SOCIAL_DAYS;
        const prefTimes = profile?.preferredSocialTimes?.length ? profile.preferredSocialTimes : DEFAULT_SOCIAL_TIMES;

        // Check day match (filter out non-day values that may be in the array)
        const validDays = prefDays.filter(d => DAY_NAMES_LOWER.includes(d));
        const dayMatch = validDays.length === 0 || validDays.includes(dayName);

        // Check time/slot match - support both bare slot names and "day:slot" format
        const slotMatch = prefTimes.some(t => t === slot || t.endsWith(`:${slot}`) || t === `${dayName}:${slot}`);
        const hasAnySlotPref = prefTimes.some(t => !DAY_NAMES_LOWER.includes(t));

        if (dayMatch) totalScore += 1;
        if (hasAnySlotPref && slotMatch) totalScore += 1;
        else if (!hasAnySlotPref && DEFAULT_SOCIAL_TIMES.includes(slot)) totalScore += 1;
      }
      return totalScore;
    }

    // Check if any participant has an existing plan on this date+slot
    function hasExistingPlan(date: Date, slot: string): boolean {
      const dateStr = format(date, 'yyyy-MM-dd');
      const participantIds = userId ? [userId, ...userIds] : userIds;
      for (const uid of participantIds) {
        if (planIndex.get(`${uid}:${dateStr}`)?.has(slot)) return true;
      }
      return false;
    }

    // Sort: social preference first, then chronologically, then no-existing-plans, then all-free > some-free
    const slotOrder: Record<string, number> = { 'late-morning': 0, 'early-afternoon': 1, 'late-afternoon': 2, 'evening': 3, 'late-night': 4 };
    results.sort((a, b) => {
      // 1. Social preference score (higher is better) — prioritize preferred days/times
      const aScore = getSocialPreferenceScore(a.date, a.slot);
      const bScore = getSocialPreferenceScore(b.date, b.slot);
      if (aScore !== bScore) return bScore - aScore;

      // 2. Chronological (soonest first)
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;

      // 3. Prefer slots where nobody has existing plans
      const aPlan = hasExistingPlan(a.date, a.slot);
      const bPlan = hasExistingPlan(b.date, b.slot);
      if (aPlan !== bPlan) return aPlan ? 1 : -1;

      // 4. All-free beats some-free
      if (a.status !== b.status) return a.status === 'all-free' ? -1 : 1;

      // 5. Slot time-of-day order
      return (slotOrder[a.slot] || 0) - (slotOrder[b.slot] || 0);
    });

    // Deduplicate: one slot per day (pick best-scored slot per day)
    const seenDays = new Set<string>();
    const deduped: BestSlot[] = [];
    for (const r of results) {
      const dayKey = format(r.date, 'yyyy-MM-dd');
      if (seenDays.has(dayKey)) continue;
      seenDays.add(dayKey);
      deduped.push(r);
      if (deduped.length >= 3) break;
    }

    setBestSlots(deduped);
    setLoadingSlots(false);
  }, [effectiveFriends, myAvailabilityMap, myPlans, homeAddress, userId]);

  // Compute solo best slots (user's free slots where no existing plan, scored by social preferences)
  const computeSoloBestSlots = useCallback(async () => {
    const allSlots: TimeSlot[] = ['late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];
    const scanDays = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    const DAY_NAMES_LOWER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const DEFAULT_SOCIAL_DAYS = ['friday', 'saturday', 'sunday'];
    const DEFAULT_SOCIAL_TIMES = ['evening'];

    // Fetch user's social preferences from profile
    let prefDays: string[] = DEFAULT_SOCIAL_DAYS;
    let prefTimes: string[] = DEFAULT_SOCIAL_TIMES;
    if (userId) {
      const { data } = await supabase.from('profiles')
        .select('preferred_social_days, preferred_social_times')
        .eq('user_id', userId).single();
      if (data) {
        if ((data as any).preferred_social_days?.length) prefDays = (data as any).preferred_social_days;
        if ((data as any).preferred_social_times?.length) prefTimes = (data as any).preferred_social_times;
      }
    }

    // Map onboarding time categories to specific slots
    const timeToSlots: Record<string, TimeSlot[]> = {
      'morning': ['late-morning'],
      'afternoon': ['early-afternoon', 'late-afternoon'],
      'evening': ['evening'],
      'late-night': ['late-night'],
    };

    function getPreferenceScore(date: Date, slot: TimeSlot): number {
      const dayName = DAY_NAMES_LOWER[date.getDay()];
      let score = 0;

      // Check day-specific slot prefs ("day:time" format)
      const daySlotMatch = prefTimes.some(t => t === `${dayName}:${slot}` || t.endsWith(`:${slot}`));
      if (daySlotMatch) score += 2;

      // Check general day preference
      const validDays = prefDays.filter(d => DAY_NAMES_LOWER.includes(d));
      if (validDays.length === 0 || validDays.includes(dayName)) score += 1;

      // Check general time preference (map onboarding categories to slots)
      const bareTimes = prefTimes.filter(t => !t.includes(':'));
      for (const bt of bareTimes) {
        const mapped = timeToSlots[bt];
        if (mapped?.includes(slot)) { score += 1; break; }
      }

      return score;
    }

    // Collect all free candidate slots
    const candidates: (BestSlot & { score: number })[] = [];
    for (const day of scanDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const myDay = myAvailabilityMap[dateStr];

      for (const slot of allSlots) {
        const myFree = myDay ? myDay.slots[slot] : true;
        const hasPlan = myPlans.some(p => isSameDay(p.date, day) && p.timeSlot === slot);
        if (myFree && !hasPlan) {
          candidates.push({
            date: day, slot, status: 'all-free', freeCount: 1, total: 0, sharedCity: '',
            score: getPreferenceScore(day, slot),
          });
        }
      }
    }

    // Sort by preference score desc, then chronological
    candidates.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.date.getTime() - b.date.getTime();
    });

    // One slot per day
    const seenDays = new Set<string>();
    const results: BestSlot[] = [];
    for (const c of candidates) {
      const dayKey = format(c.date, 'yyyy-MM-dd');
      if (seenDays.has(dayKey)) continue;
      seenDays.add(dayKey);
      results.push(c);
      if (results.length >= 3) break;
    }
    return results;
  }, [myAvailabilityMap, myPlans, userId]);

  // When step changes to 'time', fetch best slots
  useEffect(() => {
    if (step === 'time') {
      if (hasFriends) {
        fetchBestSlots();
      } else {
        // Solo mode: compute 3 free slots
        setLoadingSlots(true);
        computeSoloBestSlots().then(soloSlots => {
          setBestSlots(soloSlots);
          setLoadingSlots(false);
        });
      }
    }
  }, [step]);

  const getSlotStatusForDate = useCallback((date: Date, slot: TimeSlot): 'all-free' | 'some-free' | 'none-free' | null => {
    if (effectiveFriends.length === 0) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = friendMultiDayAvail[dateStr];
    if (!dayAvail) return null;
    const avail = dayAvail[slot];
    if (!avail) return null;

    const myDay = myAvailabilityMap[dateStr];
    const myFree = myDay ? myDay.slots[slot] : true;
    const myBusy = myPlans.some(p => isSameDay(p.date, date) && p.timeSlot === slot);
    const iAmFree = myFree && !myBusy;

    if (iAmFree && avail.free === avail.total) return 'all-free';
    if (iAmFree && avail.free > 0) return 'some-free';
    if (!iAmFree || avail.free === 0) return 'none-free';
    return null;
  }, [friendMultiDayAvail, effectiveFriends, myAvailabilityMap, myPlans]);

  const handleSelectActivity = (act: ActivityType | string) => {
    setActivity(act);
    setStep('time');
  };

  const handleSaveCustomActivity = async () => {
    if (!customLabel.trim() || !session?.user) return;
    const newActivity: CustomActivity = {
      id: `custom-${Date.now()}`,
      label: customLabel.trim(),
      icon: customEmoji,
      vibeType: 'social',
    };
    const updated = [...customActivities, newActivity];
    setCustomActivities(updated);
    await supabase.from('profiles').update({ custom_activities: updated as any }).eq('user_id', session.user.id);
    setShowCustomInput(false);
    setCustomLabel('');
    setCustomEmoji('✨');
    handleSelectActivity(newActivity.id);
  };

  const handleSelectSlot = (bs: BestSlot) => {
    // Toggle slot in multi-select
    const exists = selectedSlots.some(s => isSameDay(s.date, bs.date) && s.slot === bs.slot);
    if (exists) {
      setSelectedSlots(prev => prev.filter(s => !(isSameDay(s.date, bs.date) && s.slot === bs.slot)));
    } else {
      setSelectedSlots(prev => [...prev, { date: bs.date, slot: bs.slot }]);
    }
    setSelectedDate(bs.date);
    setTimeSlot(bs.slot);
    setSelectedSharedCity(bs.sharedCity);
  };

  const handleCalendarSelect = (date: Date, slot: TimeSlot) => {
    if (soloMode) {
      // Solo mode: single select, go straight to confirm
      setSelectedDate(date);
      setTimeSlot(slot);
      setSelectedSlots([{ date, slot }]);
    } else {
      // In multi-select calendar mode, just focus the date
      setSelectedDate(date);
      setTimeSlot(slot);
    }
  };

  const handleCalendarToggleSlot = (date: Date, slot: TimeSlot) => {
    const exists = selectedSlots.some(s => isSameDay(s.date, date) && s.slot === slot);
    if (exists) {
      setSelectedSlots(prev => prev.filter(s => !(isSameDay(s.date, date) && s.slot === slot)));
    } else {
      setSelectedSlots(prev => [...prev, { date, slot }]);
    }
  };

  const handleProceedToConfirm = () => {
    if (selectedSlots.length === 0) return;
    // Use first selected slot as the primary date/slot
    setSelectedDate(selectedSlots[0].date);
    setTimeSlot(selectedSlots[0].slot);
    setStep('confirm');
  };

  const activityLabel = activity === TBD_ACTIVITY_ID ? TBD_LABEL : activity ? (ACTIVITY_CONFIG[activity as ActivityType]?.label || customActivities.find(a => a.id === activity)?.label || activity) : '';
  const activityEmoji = activity === TBD_ACTIVITY_ID ? TBD_EMOJI : activity ? (ACTIVITY_CONFIG[activity as ActivityType]?.icon || customActivities.find(a => a.id === activity)?.icon || '📅') : '';

  const autoTitle = activity
    ? (hasFriends ? `${activityLabel} with ${friendNames.join(', ')}` : activityLabel)
    : (hasFriends ? `Hang with ${friendNames.join(', ')}` : 'Solo Plan');

  const handleSubmit = async () => {
    if (!activity || selectedSlots.length === 0) return;
    const primarySlot = selectedSlots[0];
    setSending(true);

    try {
      const hasMultipleOptions = selectedSlots.length > 1;

      if (hasFriends) {
        // Plan with friends - use proposePlan flow
        const firstFriend = effectiveFriends[0];
        await proposePlan({
          recipientFriendId: firstFriend.userId,
          activity: activity,
          date: primarySlot.date,
          timeSlot: primarySlot.slot,
          title: autoTitle,
        });

        // Get the newly created plan
        const { data: latestPlan } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', userId || '')
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestPlan) {
          if (effectiveFriends.length > 1) {
            const additionalParticipants = effectiveFriends.slice(1).map(f => ({
              plan_id: latestPlan.id,
              friend_id: f.userId,
              status: 'invited',
              role: 'participant',
            }));
            await supabase.from('plan_participants').insert(additionalParticipants);
          }

          if (hasMultipleOptions) {
            await supabase.from('plans').update({
              proposal_status: 'voting',
            }).eq('id', latestPlan.id);

            const proposalOptions = selectedSlots.map((s, i) => ({
              plan_id: latestPlan.id,
              date: `${format(s.date, 'yyyy-MM-dd')}T12:00:00+00:00`,
              time_slot: s.slot,
              sort_order: i,
            }));
            await supabase.from('plan_proposal_options').insert(proposalOptions);
          }
        }

        toast.success(`Plan sent to ${friendNamesStr}! 🎉`);
      } else {
        // Solo plan - create confirmed plan directly
        const dateStr = format(primarySlot.date, 'yyyy-MM-dd');
        const noonUtcDate = `${dateStr}T12:00:00+00:00`;

        await supabase.from('plans').insert({
          user_id: userId,
          title: autoTitle,
          activity: activity,
          date: noonUtcDate,
          time_slot: primarySlot.slot,
          duration: 60,
          status: 'confirmed',
          feed_visibility: 'private',
          source_timezone: usePlannerStore.getState().userTimezone,
        } as any);

        // Reload data
        await usePlannerStore.getState().loadPlans();
        toast.success('Plan created! 🎉');
      }

      confetti({
        particleCount: 80,
        spread: 55,
        origin: { y: 0.75 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'],
        scalar: 0.9,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create plan:', err);
      toast.error('Something went wrong. Try again?');
    } finally {
      setSending(false);
    }
  };

  const stepTitle = step === 'friends'
    ? 'Who do you want to hang with?'
    : step === 'activity'
      ? (hasFriends ? `What do you want to do with ${friendNamesStr}?` : 'What do you want to do?')
        : step === 'time'
          ? (activity === TBD_ACTIVITY_ID ? 'When works?' : hasFriends ? `When works for ${activityLabel.toLowerCase()}?` : `When do you want to do ${activityLabel.toLowerCase()}?`)
        : 'Look good?';

  const firstStep = needsFriendStep ? 'friends' : 'activity';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[90vh]"
        style={viewport ? { maxHeight: `${Math.min(viewport.height * 0.9, window.innerHeight * 0.9)}px` } : undefined}
      >
        <DrawerHeader className="pb-2 relative">
          {step !== firstStep && (
            <button
              onClick={() => {
                if (step === 'confirm') { setStep('time'); setShowCalendar(false); }
                else if (step === 'time') setStep('activity');
                else if (step === 'activity' && needsFriendStep) setStep('friends');
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <DrawerTitle className="text-center text-sm font-semibold px-8">
            {stepTitle}
          </DrawerTitle>
        </DrawerHeader>

        {/* Friend avatars strip - show when past friends step */}
        {step !== 'friends' && effectiveFriends.length > 0 && (
          <div className="flex items-center justify-center gap-1 px-4 pb-3">
            <div className="flex -space-x-2">
              {effectiveFriends.slice(0, 5).map(f => (
                <Avatar key={f.userId} className="h-7 w-7 border-2 border-background">
                  <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                  <AvatarFallback className="text-[9px]">{f.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-2">{friendNamesStr}</span>
          </div>
        )}

        <div className="px-4 pb-2 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {/* STEP 0: Friend selection */}
            {step === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search friends..."
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {chosenFriends.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {chosenFriends.map(f => (
                      <button
                        key={f.userId}
                        onClick={() => toggleFriend({ friendUserId: f.userId, name: f.name, avatar: f.avatar, status: 'connected' } as any)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                          <AvatarFallback className="text-[6px]">{f.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {f.name.split(' ')[0]}
                        <span className="text-primary/60">×</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1 max-h-[280px] overflow-y-auto">
                  {filteredFriends.length > 0 ? filteredFriends.map(f => {
                    const isChosen = chosenFriends.some(c => c.userId === f.friendUserId);
                    return (
                      <button
                        key={f.friendUserId}
                        onClick={() => toggleFriend(f)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                          isChosen
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50 border border-transparent"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                          <AvatarFallback className="text-xs">{f.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium flex-1">{f.name}</span>
                        <div className={cn(
                          "flex items-center justify-center h-5 w-5 rounded-full border-2 shrink-0 transition-all",
                          isChosen
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}>
                          {isChosen && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="text-center py-6">
                      <p className="text-xs text-muted-foreground">No friends found</p>
                    </div>
                  )}
                </div>

                {/* Just me button */}
                <button
                  onClick={() => { setSoloMode(true); setStep('activity'); }}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Just me — no friends needed
                </button>
              </motion.div>
            )}

            {/* STEP 1: Activity selection */}
            {step === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {/* Search with dropdown */}
                {(() => {
                  const q = activitySearch.trim().toLowerCase();
                  const matchedCustom = customActivities.filter(
                    a => !q || a.label.toLowerCase().includes(q)
                  );
                  const vibeGroups = getAllVibes()
                    .map(vibe => ({
                      vibe,
                      config: VIBE_CONFIG[vibe],
                      activities: getActivitiesByVibe(vibe).filter(
                        a => !q || ACTIVITY_CONFIG[a].label.toLowerCase().includes(q)
                      ),
                    }))
                    .filter(g => g.activities.length > 0);
                  const hasResults = matchedCustom.length > 0 || vibeGroups.length > 0;
                  const showDropdown = activitySearchFocused || q.length > 0;

                  return (
                    <div className="relative">
                      <Search className="absolute left-3 top-[18px] -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                      <Input
                        placeholder="Search activities..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        onFocus={() => setActivitySearchFocused(true)}
                        onBlur={() => setTimeout(() => setActivitySearchFocused(false), 150)}
                        className="pl-9 h-9 text-sm"
                      />

                      {showDropdown && (
                        <div className="absolute left-0 right-0 top-10 z-20 max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg p-2 space-y-3">
                          {!hasResults && (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              No activities found
                            </p>
                          )}

                          {matchedCustom.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                                Your Activities
                              </p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {matchedCustom.map(a => (
                                  <motion.button
                                    key={a.id}
                                    whileTap={{ scale: 0.97 }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelectActivity(a.id)}
                                    className="flex flex-col items-center gap-1 rounded-xl border border-border px-2 py-2 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
                                  >
                                    <span className="text-lg">{a.icon}</span>
                                    <span className="text-[11px] font-medium text-foreground leading-tight truncate w-full">{a.label}</span>
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          )}

                          {vibeGroups.map(({ vibe, config: vibeConfig, activities }) => (
                            <div key={vibe}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5 flex items-center gap-1">
                                <vibeConfig.icon className="h-3 w-3" />
                                {vibeConfig.label}
                              </p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {activities.map(type => {
                                  const config = ACTIVITY_CONFIG[type];
                                  return (
                                    <motion.button
                                      key={type}
                                      whileTap={{ scale: 0.97 }}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => handleSelectActivity(type)}
                                      className="flex flex-col items-center gap-1 rounded-xl border border-border px-2 py-2 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
                                    >
                                      <span className="text-lg">{config.icon}</span>
                                      <span className="text-[11px] font-medium text-foreground leading-tight truncate w-full">{config.label}</span>
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* TBD option */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelectActivity(TBD_ACTIVITY_ID)}
                  className="w-full flex items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  <CircleHelp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">TBD — decide later</span>
                </motion.button>

                {/* Custom activity creation */}
                {!showCustomInput ? (
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create custom activity
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                    <input
                      type="text"
                      maxLength={2}
                      value={customEmoji}
                      onChange={(e) => setCustomEmoji(e.target.value || '✨')}
                      className="w-8 h-8 text-center text-lg bg-transparent border border-border rounded-lg outline-none focus:border-primary"
                    />
                    <Input
                      placeholder="Activity name"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="h-8 text-sm flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomActivity()}
                      autoFocus
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={handleSaveCustomActivity} disabled={!customLabel.trim()}>
                      Add
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Time selection */}
            {step === 'time' && !showCalendar && (
              <motion.div
                key="time"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Activity badge */}
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium">
                    {activityEmoji} {activityLabel}
                  </span>
                  {selectedSlots.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                      {selectedSlots.length} selected
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  Select one or more time slots to propose
                </p>

                {loadingSlots ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Finding the best times for everyone...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bestSlots.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 justify-center">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {hasFriends ? 'Best times for everyone' : 'You\'re free'}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {bestSlots.map((bs, i) => (
                            <SlotCard
                              key={`${format(bs.date, 'yyyy-MM-dd')}-${bs.slot}`}
                              bs={bs} i={i} onSelect={handleSelectSlot}
                              isSelected={selectedSlots.some(s => isSameDay(s.date, bs.date) && s.slot === bs.slot)}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <span className="text-2xl">{hasFriends ? '🌎' : '📅'}</span>
                        <p className="text-sm font-medium text-foreground">
                          {hasFriends ? 'No overlapping times found' : 'No free slots found'}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-[240px]">
                          {hasFriends
                            ? `It looks like you and ${friendNamesStr} won't be in the same city in the next 6 months.`
                            : 'Your schedule looks packed! Pick a time manually below.'}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowCalendar(true)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      Pick a different date & time
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2b: Calendar picker (multi-select) */}
            {step === 'time' && showCalendar && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowCalendar(false)}
                    className="flex items-center gap-1 text-xs text-primary font-medium"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to suggestions
                  </button>
                  {selectedSlots.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-semibold">
                      {selectedSlots.length} selected
                    </span>
                  )}
                </div>
                <SlotCalendarPicker
                  selectedDate={selectedDate}
                  selectedSlot={timeSlot}
                  onSelect={handleCalendarSelect}
                  getSlotStatus={hasFriends ? getSlotStatusForDate : undefined}
                  hasFriends={hasFriends}
                  days={180}
                  multiSelect={!soloMode}
                  selectedSlots={selectedSlots}
                  onToggleSlot={handleCalendarToggleSlot}
                />
              </motion.div>
            )}

            {/* STEP 3: Confirmation */}
            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="space-y-4"
              >
                {/* Summary card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{activityEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground">{autoTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {hasFriends ? `Proposed plan with ${friendNamesStr}` : 'Solo plan — invite friends later'}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {selectedSlots.length > 1 ? `Proposed times (${selectedSlots.length} options)` : 'When'}
                    </p>
                    <div className={cn("space-y-1.5", selectedSlots.length > 3 && "max-h-[120px] overflow-y-auto")}>
                      {selectedSlots.map((s, i) => {
                        const dayLabel = isSameDay(s.date, new Date())
                          ? 'Today'
                          : isSameDay(s.date, addDays(new Date(), 1))
                            ? 'Tomorrow'
                            : format(s.date, 'EEE, MMM d');
                        return (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-primary font-semibold text-xs">{i + 1}.</span>
                            <span className="font-medium text-foreground">{dayLabel}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground text-xs">{SLOT_LABELS[s.slot]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {hasFriends && (
                    <>
                      <div className="h-px bg-border" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">With</p>
                        <div className="flex -space-x-1.5">
                          {effectiveFriends.slice(0, 4).map(f => (
                            <Avatar key={f.userId} className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                              <AvatarFallback className="text-[7px]">{f.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-primary dark:text-primary">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium">
                    {!hasFriends ? '✅ Confirmed' : selectedSlots.length > 1 ? '🗳️ Vote' : '💡 Proposed'}
                  </span>
                  <span className="text-muted-foreground">
                    {!hasFriends
                      ? '— you can invite friends anytime'
                      : selectedSlots.length > 1
                        ? '— friends will vote on their preferred time'
                        : '— confirmed when they accept'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with Continue or Submit button */}
        {step === 'friends' && (
          <DrawerFooter className="pt-2">
            <Button
              onClick={() => setStep('activity')}
              disabled={chosenFriends.length === 0}
              className="w-full gap-2"
            >
              Continue with {chosenFriends.length} {chosenFriends.length === 1 ? 'friend' : 'friends'} →
            </Button>
          </DrawerFooter>
        )}

        {step === 'time' && selectedSlots.length > 0 && (
          <DrawerFooter className="pt-2">
            <Button
              onClick={handleProceedToConfirm}
              className="w-full gap-2"
            >
              Continue with {selectedSlots.length} {selectedSlots.length === 1 ? 'time' : 'times'} →
            </Button>
          </DrawerFooter>
        )}

        {step === 'confirm' && (
          <DrawerFooter className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={sending}
              className="w-full gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {!hasFriends
                ? 'Create Plan →'
                : selectedSlots.length > 1
                  ? `Send ${selectedSlots.length} Time Options →`
                  : 'Send Plan Suggestion →'}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
export default GuidedPlanSheet;
