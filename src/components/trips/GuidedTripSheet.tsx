import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval,
  isFriday, isSaturday, isSunday, addDays, getDay,
} from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, ArrowLeft, Sparkles, Check, MapPin, Plane, Search, X, Home,
} from 'lucide-react';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { cn } from '@/lib/utils';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePlannerStore } from '@/stores/plannerStore';
import { Friend, TimeSlot } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { useAuth } from '@/hooks/useAuth';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { InviteToTripDialog } from './InviteToTripDialog';

interface PreSelectedFriend {
  userId: string;
  name: string;
  avatar?: string;
}

interface GuidedTripSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedFriends?: PreSelectedFriend[];
  preSelectedType?: 'trip' | 'visit';
}

type Step = 'type' | 'friends' | 'months' | 'weekends' | 'confirm';

type ProposalType = 'trip' | 'visit';
type HostMode = 'hosting' | 'visiting';

interface WeekendOption {
  fridayDate: Date;
  sundayDate: Date;
  score: number;
  availPct: number;
  hasConflict: boolean;
  perParticipant: { userId: string; freeSlots: number; totalSlots: number }[];
}

const ALL_WEEKEND_SLOTS: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night',
];

const SLOT_HOURS: Record<string, [number, number]> = {
  'early-morning': [2, 9],
  'late-morning': [9, 12],
  'early-afternoon': [12, 16],
  'late-afternoon': [16, 19],
  'evening': [19, 22],
  'late-night': [22, 26],
};
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getDefaultSlotFree(
  profile: { defaultWorkDays: string[]; defaultWorkStartHour: number; defaultWorkEndHour: number; defaultAvailStatus: string } | undefined,
  date: Date,
  slot: string,
): boolean {
  if (!profile) return false;
  if (profile.defaultAvailStatus === 'unavailable') return false;
  const dayName = DAY_NAMES[date.getDay()];
  const isWorkDay = profile.defaultWorkDays.includes(dayName);
  if (!isWorkDay) return true;
  const [slotStart, slotEnd] = SLOT_HOURS[slot] || [0, 0];
  if (slotStart < profile.defaultWorkEndHour && slotEnd > profile.defaultWorkStartHour) return false;
  return true;
}

function useSuggestedFriends(connectedFriends: Friend[]) {
  const { user } = useAuth();
  const { plans } = usePlannerStore();
  return useMemo(() => {
    if (!user?.id || connectedFriends.length === 0) return connectedFriends.slice(0, 5);
    const coCount = new Map<string, number>();
    for (const plan of plans) {
      if (!plan.participants) continue;
      for (const p of plan.participants) {
        if (p.friendUserId && p.friendUserId !== user.id)
          coCount.set(p.friendUserId, (coCount.get(p.friendUserId) || 0) + 1);
      }
    }
    const scored = connectedFriends.map(f => ({
      friend: f,
      score: f.friendUserId ? (coCount.get(f.friendUserId) || 0) : 0,
    }));
    scored.sort((a, b) => b.score - a.score || a.friend.name.localeCompare(b.friend.name));
    return scored.slice(0, 5).map(s => s.friend);
  }, [user?.id, connectedFriends, plans]);
}

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export function GuidedTripSheet({ open, onOpenChange, preSelectedFriends, preSelectedType }: GuidedTripSheetProps) {
  const { user } = useAuth();
  const { friends: allFriends, userId, loadProfileAndAvailability, loadPlans } = usePlannerStore();
  const viewport = useVisualViewport();

  const connectedFriends = useMemo(() => allFriends.filter(f => f.status === 'connected'), [allFriends]);
  const suggestedFriends = useSuggestedFriends(connectedFriends);

  const [step, setStep] = useState<Step>('friends');
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // "2026-07" format
  const [weekends, setWeekends] = useState<WeekendOption[]>([]);
  const [loadingWeekends, setLoadingWeekends] = useState(false);
  const [selectedWeekends, setSelectedWeekends] = useState<WeekendOption[]>([]);
   const [destination, setDestination] = useState('');
   const [sending, setSending] = useState(false);
   const [postCreateShare, setPostCreateShare] = useState<{ proposalId: string; destination: string | null; type: 'trip' | 'visit' } | null>(null);
   const [monthStats, setMonthStats] = useState<Record<string, { freeWeekends: number; totalWeekends: number; tripConflicts: number }>>({}); 
   const [loadingMonthStats, setLoadingMonthStats] = useState(false);
   const [proposalType, setProposalType] = useState<ProposalType>('trip');
   const [hostMode, setHostMode] = useState<HostMode>('hosting');
   const [hostUserId, setHostUserId] = useState<string | null>(null);
   const [friendHomeAddresses, setFriendHomeAddresses] = useState<Record<string, string>>({});

  // Generate month options (next 12 months)
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = addMonths(now, i + 1);
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy'), date: d };
    });
  }, []);

  // Fetch month-level availability stats for the current user
  useEffect(() => {
    if (!open || !userId || step !== 'months') return;
    let cancelled = false;
    const fetchMonthStats = async () => {
      setLoadingMonthStats(true);
      const firstMonth = monthOptions[0].date;
      const lastMonth = monthOptions[monthOptions.length - 1].date;
      const rangeStart = format(startOfMonth(firstMonth), 'yyyy-MM-dd');
      const rangeEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');

      const [availRes, tripsRes] = await Promise.all([
        supabase.from('availability').select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night')
          .eq('user_id', userId).gte('date', rangeStart).lte('date', rangeEnd),
        supabase.from('trips').select('start_date, end_date')
          .eq('user_id', userId).gte('end_date', rangeStart).lte('start_date', rangeEnd),
      ]);
      if (cancelled) return;

      const availByDate = new Map<string, number>();
      for (const row of availRes.data || []) {
        const slots = [row.early_morning, row.late_morning, row.early_afternoon, row.late_afternoon, row.evening, row.late_night];
        availByDate.set(row.date, slots.filter(Boolean).length);
      }
      const trips = tripsRes.data || [];

      const stats: Record<string, { freeWeekends: number; totalWeekends: number; tripConflicts: number }> = {};
      for (const mo of monthOptions) {
        const monthStart = startOfMonth(mo.date);
        const monthEnd = endOfMonth(mo.date);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const fridays = days.filter(d => isFriday(d));
        let freeWeekends = 0;
        let tripConflicts = 0;
        for (const fri of fridays) {
          const sat = addDays(fri, 1);
          const sun = addDays(fri, 2);
          const weekendDates = [fri, sat, sun].map(d => format(d, 'yyyy-MM-dd'));
          const hasTrip = trips.some(t =>
            weekendDates.some(wd => wd >= t.start_date && wd <= t.end_date)
          );
          if (hasTrip) { tripConflicts++; continue; }
          const totalFree = weekendDates.reduce((sum, d) => sum + (availByDate.get(d) ?? 6), 0);
          if (totalFree >= 6) freeWeekends++;
        }
        stats[mo.key] = { freeWeekends, totalWeekends: fridays.length, tripConflicts };
      }
      setMonthStats(stats);
      setLoadingMonthStats(false);
    };
    fetchMonthStats();
    return () => { cancelled = true; };
  }, [open, userId, step, monthOptions]);

  // Fetch home addresses of selected friends when entering type step (for visit)
  useEffect(() => {
    if (step !== 'friends' || selectedFriends.length === 0) return;
    const friendUserIds = selectedFriends.map(f => f.friendUserId).filter(Boolean) as string[];
    if (friendUserIds.length === 0) return;
    supabase
      .from('friend_profiles')
      .select('user_id, home_address')
      .in('user_id', friendUserIds)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const p of data || []) {
          if (p.home_address) map[p.user_id] = p.home_address;
        }
        setFriendHomeAddresses(map);
      });
  }, [step, selectedFriends]);

  // Reset on open, pre-select friends if provided
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setSelectedMonths([]);
      setWeekends([]);
      setSelectedWeekends([]);
      setDestination('');
      setSending(false);
      setProposalType(preSelectedType || 'trip');
      setHostMode('hosting');
      setHostUserId(null);
      setFriendHomeAddresses({});

      if (preSelectedFriends && preSelectedFriends.length > 0) {
        const matched = connectedFriends.filter(f =>
          preSelectedFriends.some(ps => ps.userId === f.friendUserId)
        );
        setSelectedFriends(matched);
        setStep(matched.length > 0 ? 'months' : 'type');
      } else {
        setSelectedFriends([]);
        setStep('type');
      }
    }
  }, [open, preSelectedFriends, connectedFriends, preSelectedType]);

  const toggleFriend = (f: Friend) => {
    setSelectedFriends(prev =>
      prev.find(p => p.id === f.id) ? prev.filter(p => p.id !== f.id) : [...prev, f]
    );
  };

  const toggleMonth = (key: string) => {
    setSelectedMonths(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const friendNames = selectedFriends.map(f => f.name.split(' ')[0]);
  const friendNamesStr = friendNames.length <= 2 ? friendNames.join(' & ') : `${friendNames.slice(0, -1).join(', ')} & ${friendNames[friendNames.length - 1]}`;

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return connectedFriends;
    const q = searchQuery.toLowerCase();
    return connectedFriends.filter(f => f.name.toLowerCase().includes(q));
  }, [connectedFriends, searchQuery]);

  // Fetch and score weekends
  const analyzeWeekends = useCallback(async () => {
    if (selectedMonths.length === 0) return;
    setLoadingWeekends(true);

    const friendUserIds = selectedFriends.map(f => f.friendUserId).filter(Boolean) as string[];
    const allUserIds = userId ? [userId, ...friendUserIds] : friendUserIds;

    // Collect all weekends (Fri-Sun) across selected months
    const weekendDates: { friday: Date; sunday: Date }[] = [];
    for (const monthKey of selectedMonths) {
      const [y, m] = monthKey.split('-').map(Number);
      const monthStart = startOfMonth(new Date(y, m - 1));
      const monthEnd = endOfMonth(monthStart);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      for (const day of days) {
        if (isFriday(day)) {
          weekendDates.push({ friday: day, sunday: addDays(day, 2) });
        }
      }
    }
    // Filter to future weekends only
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureWeekends = weekendDates.filter(w => w.friday >= today);

    if (futureWeekends.length === 0) {
      setWeekends([]);
      setLoadingWeekends(false);
      return;
    }

    // Determine date range for queries
    const allDates = futureWeekends.flatMap(w => [w.friday, w.sunday]);
    const startDate = format(allDates.reduce((a, b) => a < b ? a : b), 'yyyy-MM-dd');
    const endDate = format(allDates.reduce((a, b) => a > b ? a : b), 'yyyy-MM-dd');

    const [
      { data: availData },
      { data: plansData },
      { data: profilesData },
      { data: tripsData },
      { data: participatedPlansData },
    ] = await Promise.all([
      supabase.from('availability').select('*').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate),
      supabase.from('plans').select('time_slot, user_id, date, status').in('user_id', allUserIds).gte('date', startDate).lte('date', endDate).in('status', ['confirmed', 'proposed']),
      supabase.from('friend_profiles').select('user_id, default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status, preferred_social_days, preferred_social_times').in('user_id', allUserIds),
      supabase.from('trips').select('user_id, location, start_date, end_date').in('user_id', allUserIds).gte('end_date', startDate).lte('start_date', endDate),
      supabase.from('plan_participants').select('friend_id, plan_id, status, plans!inner(date, time_slot, status)').in('friend_id', allUserIds).in('status', ['accepted', 'invited']),
    ]);

    // Build profile map
    const profileMap = new Map<string, {
      defaultWorkDays: string[];
      defaultWorkStartHour: number;
      defaultWorkEndHour: number;
      defaultAvailStatus: string;
      preferredSocialDays: string[];
      preferredSocialTimes: string[];
    }>();
    for (const p of (profilesData || [])) {
      profileMap.set(p.user_id, {
        defaultWorkDays: (p.default_work_days as string[]) || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        defaultWorkStartHour: (p.default_work_start_hour as number) ?? 9,
        defaultWorkEndHour: (p.default_work_end_hour as number) ?? 17,
        defaultAvailStatus: (p.default_availability_status as string) || 'free',
        preferredSocialDays: (p.preferred_social_days as string[]) || [],
        preferredSocialTimes: (p.preferred_social_times as string[]) || [],
      });
    }

    // Index availability
    const availIndex = new Map<string, any>();
    for (const a of (availData || [])) {
      availIndex.set(`${a.user_id}:${a.date}`, a);
    }

    // Index plans by user:date → set of busy slots
    const planIndex = new Map<string, Set<string>>();
    for (const p of (plansData || [])) {
      const key = `${p.user_id}:${p.date?.slice(0, 10)}`;
      if (!planIndex.has(key)) planIndex.set(key, new Set());
      planIndex.get(key)!.add(p.time_slot);
    }
    for (const pp of (participatedPlansData || [])) {
      const plan = (pp as any).plans;
      if (!plan || plan.status === 'cancelled' || plan.status === 'declined') continue;
      const dateStr = plan.date?.slice(0, 10);
      if (!dateStr) continue;
      const key = `${pp.friend_id}:${dateStr}`;
      if (!planIndex.has(key)) planIndex.set(key, new Set());
      planIndex.get(key)!.add(plan.time_slot);
    }

    // Index trips by user
    const tripsByUser = new Map<string, { start_date: string; end_date: string; location: string | null }[]>();
    for (const t of (tripsData || [])) {
      if (!tripsByUser.has(t.user_id)) tripsByUser.set(t.user_id, []);
      tripsByUser.get(t.user_id)!.push(t);
    }

    function userHasTripOnDate(uid: string, dateStr: string): boolean {
      const trips = tripsByUser.get(uid);
      if (!trips) return false;
      return trips.some(t => dateStr >= t.start_date && dateStr <= t.end_date);
    }

    // Social preference defaults
    const DEFAULT_SOCIAL_DAYS = ['friday', 'saturday', 'sunday'];
    const DEFAULT_SOCIAL_TIMES = ['evening'];

    // Score each weekend
    const results: WeekendOption[] = [];

    for (const { friday, sunday } of futureWeekends) {
      const weekendDays = [friday, addDays(friday, 1), sunday]; // Fri, Sat, Sun
      let totalFreeSlots = 0;
      let totalPossibleSlots = 0;
      let hasConflict = false;
      const perParticipant: WeekendOption['perParticipant'] = [];

      for (const uid of allUserIds) {
        let userFree = 0;
        let userTotal = 0;

        for (const day of weekendDays) {
          const dateStr = format(day, 'yyyy-MM-dd');

          // Check trip conflict
          if (userHasTripOnDate(uid, dateStr)) {
            hasConflict = true;
          }

          for (const slot of ALL_WEEKEND_SLOTS) {
            userTotal++;
            const row = availIndex.get(`${uid}:${dateStr}`);
            const colName = slot.replace(/-/g, '_');
            const isAvailable = row ? ((row as any)[colName] ?? true) : getDefaultSlotFree(profileMap.get(uid), day, slot);
            const hasPlan = planIndex.get(`${uid}:${dateStr}`)?.has(slot) || false;
            if (isAvailable && !hasPlan) userFree++;
          }
        }

        perParticipant.push({ userId: uid, freeSlots: userFree, totalSlots: userTotal });
        totalFreeSlots += userFree;
        totalPossibleSlots += userTotal;
      }

      // Social preference bonus
      let socialBonus = 0;
      for (const day of weekendDays) {
        const dayName = DAY_NAMES[day.getDay()];
        for (const uid of allUserIds) {
          const profile = profileMap.get(uid);
          const prefDays = profile?.preferredSocialDays?.length ? profile.preferredSocialDays : DEFAULT_SOCIAL_DAYS;
          if (prefDays.includes(dayName)) socialBonus += 1;
        }
      }

      const conflictPenalty = hasConflict ? -1000 : 0;
      const score = totalFreeSlots + socialBonus + conflictPenalty;
      const availPct = totalPossibleSlots > 0 ? Math.round((totalFreeSlots / totalPossibleSlots) * 100) : 0;

      results.push({
        fridayDate: friday,
        sundayDate: sunday,
        score,
        availPct,
        hasConflict,
        perParticipant,
      });
    }

    // Sort: score DESC, then chronologically
    results.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.fridayDate.getTime() - b.fridayDate.getTime();
    });

    setWeekends(results);
    setLoadingWeekends(false);
  }, [selectedMonths, selectedFriends, userId]);

  useEffect(() => {
    if (step === 'weekends') {
      analyzeWeekends();
    }
  }, [step]);

  const toggleWeekend = (w: WeekendOption) => {
    setSelectedWeekends(prev => {
      const exists = prev.find(p => p.fridayDate.getTime() === w.fridayDate.getTime());
      if (exists) return prev.filter(p => p.fridayDate.getTime() !== w.fridayDate.getTime());
      if (prev.length >= 5) {
        toast.error('You can select up to 5 date ranges');
        return prev;
      }
      return [...prev, w];
    });
  };

  const isWeekendSelected = (w: WeekendOption) =>
    selectedWeekends.some(s => s.fridayDate.getTime() === w.fridayDate.getTime());

  const handleSubmit = async () => {
    if (!userId || selectedWeekends.length === 0 || selectedFriends.length === 0) return;
    setSending(true);

    try {
      // Create proposal
      const { data: proposal, error: proposalErr } = await supabase
        .from('trip_proposals')
        .insert({
          created_by: userId,
          destination: destination || null,
          status: 'pending',
          proposal_type: proposalType,
          host_user_id: proposalType === 'visit' ? hostUserId : null,
        } as any)
        .select('id')
        .single();
      if (proposalErr || !proposal) throw proposalErr;

      // Insert dates
      const dateRows = selectedWeekends.map(w => ({
        proposal_id: proposal.id,
        start_date: format(w.fridayDate, 'yyyy-MM-dd'),
        end_date: format(w.sundayDate, 'yyyy-MM-dd'),
      }));
      await supabase.from('trip_proposal_dates').insert(dateRows);

      // Insert participants (including the creator)
      const friendUserIds = selectedFriends.map(f => f.friendUserId).filter(Boolean) as string[];
      const allParticipantIds = [userId, ...friendUserIds.filter(id => id !== userId)];
      const participantRows = allParticipantIds.map(uid => ({
        proposal_id: proposal.id,
        user_id: uid,
        status: uid === userId ? 'voted' as const : 'pending' as const,
      }));
      if (participantRows.length > 0) {
        await supabase.from('trip_proposal_participants').insert(participantRows);
      }

      // Send push notifications to participants (fire-and-forget)
      if (friendUserIds.length > 0) {
        const senderName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Someone';
        const isVisit = proposalType === 'visit';
        const notifTitle = isVisit ? '🏠 Visit Proposal' : '✈️ Trip Proposal';
        let notifBody: string;
        if (isVisit && hostMode === 'hosting') {
          notifBody = `${senderName} is hosting in ${destination || 'their city'} — vote on dates!`;
        } else if (isVisit) {
          notifBody = `${senderName} wants to plan a visit to ${destination || 'your city'}`;
        } else {
          const destText = destination ? ` to ${destination}` : '';
          notifBody = `${senderName} shared trip options${destText} with you`;
        }
        supabase.functions.invoke('send-push-notification', {
          body: {
            user_ids: friendUserIds,
            title: notifTitle,
            body: notifBody,
            url: '/trips',
          },
        }).catch(() => {});
      }

      confetti({
        particleCount: 80,
        spread: 55,
        origin: { y: 0.75 },
        colors: ['#3D8C6C', '#FF6B6B', '#F59E0B', '#8B5CF6', '#3B82F6'],
        scalar: 0.9,
      });
      const isVisitMsg = proposalType === 'visit';
      toast.success(isVisitMsg
        ? `Visit options shared with ${friendNamesStr}! 🏠`
        : `Trip options shared with ${friendNamesStr}! ✈️`
      );
      setPostCreateShare({ proposalId: proposal.id, destination: destination || null, type: proposalType });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create trip proposal:', err);
      toast.error('Something went wrong. Try again?');
    } finally {
      setSending(false);
    }
  };

  // Solo trip: create a confirmed trip directly (no proposal)
  const handleSoloSubmit = async () => {
    if (!userId || selectedWeekends.length === 0) return;
    setSending(true);
    try {
      // Use the first selected weekend as the trip dates
      const sorted = [...selectedWeekends].sort((a, b) => a.fridayDate.getTime() - b.fridayDate.getTime());
      const firstWeekend = sorted[0];
      const lastWeekend = sorted[sorted.length - 1];
      const startDate = format(firstWeekend.fridayDate, 'yyyy-MM-dd');
      const endDate = format(lastWeekend.sundayDate, 'yyyy-MM-dd');

      const { error } = await supabase.from('trips').insert({
        user_id: userId,
        location: destination.trim() || null,
        start_date: startDate,
        end_date: endDate,
        available_slots: ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'],
        priority_friend_ids: [],
      });
      if (error) throw error;

      // Also set availability to away for those dates
      const { eachDayOfInterval: eachDay } = await import('date-fns');
      const days = eachDay({ start: firstWeekend.fridayDate, end: lastWeekend.sundayDate });
      const availRows = days.map(d => ({
        user_id: userId,
        date: format(d, 'yyyy-MM-dd'),
        location_status: 'away',
        trip_location: destination.trim() || null,
        early_morning: true, late_morning: true, early_afternoon: true,
        late_afternoon: true, evening: true, late_night: true,
      }));
      await supabase.from('availability').upsert(availRows, { onConflict: 'user_id,date', ignoreDuplicates: false });

      confetti({ particleCount: 60, spread: 50, origin: { y: 0.75 }, colors: ['#3D8C6C', '#FF6B6B', '#F59E0B'], scalar: 0.9 });
      toast.success(destination ? `Trip to ${destination} created! ✈️` : 'Trip created! ✈️');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create solo trip:', err);
      toast.error('Something went wrong. Try again?');
    } finally {
      setSending(false);
    }
  };

  const isVisit = proposalType === 'visit';
  const isSoloTrip = selectedFriends.length === 0 && proposalType === 'trip';
  const stepTitle = step === 'type'
    ? 'Trip or Visit?'
    : step === 'friends'
      ? isVisit ? 'Who are you visiting with?' : 'Add friends (optional)'
      : step === 'months'
        ? 'Which months work?'
        : step === 'weekends'
          ? isSoloTrip ? 'Pick your weekends' : `Best weekends for ${friendNamesStr}`
          : isVisit ? 'Your visit options' : isSoloTrip ? 'Your trip' : 'Your trip options';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[90vh]"
        style={viewport ? { maxHeight: `${Math.min(viewport.height * 0.9, window.innerHeight * 0.9)}px` } : undefined}
      >
        <DrawerHeader className="pb-2 relative">
          {step !== 'type' && (
            <button
              onClick={() => {
                if (step === 'confirm') setStep('weekends');
                else if (step === 'weekends') { setStep('months'); setSelectedWeekends([]); }
                else if (step === 'months') setStep('friends');
                else if (step === 'friends') setStep('type');
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

        {/* Friend chips strip (shown after friend selection step) */}
        {step !== 'type' && step !== 'friends' && selectedFriends.length > 0 && (
          <div className="flex items-center justify-center gap-1 px-4 pb-3">
            <div className="flex -space-x-2">
              {selectedFriends.slice(0, 5).map(f => (
                <Avatar key={f.id} className="h-7 w-7 border-2 border-background">
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
            {/* STEP 1: Type selection (trip vs visit) */}
            {step === 'type' && (
              <motion.div
                key="type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-xs text-muted-foreground text-center">
                  What kind of plans are you making?
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setProposalType('trip'); setHostUserId(null); setStep('friends'); }}
                    className={cn(
                      "rounded-xl border p-4 text-center transition-all space-y-2",
                      "border-border hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    <Plane className="h-6 w-6 mx-auto text-primary" />
                    <p className="text-sm font-semibold">Plan a Trip</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Travel somewhere new</p>
                  </button>
                  <button
                    onClick={() => { setProposalType('visit'); setStep('friends'); }}
                    className={cn(
                      "rounded-xl border p-4 text-center transition-all space-y-2",
                      "border-border hover:border-primary/30 hover:bg-primary/5"
                    )}
                  >
                    <Home className="h-6 w-6 mx-auto text-primary" />
                    <p className="text-sm font-semibold">Plan a Visit</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Visit a friend or host them</p>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Friend selection */}
            {step === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {/* Visit sub-choice: who's hosting? */}
                {proposalType === 'visit' && (
                  <div className="space-y-3 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Who's hosting?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setHostMode('hosting');
                          setHostUserId(userId || null);
                          supabase.from('friend_profiles').select('home_address').eq('user_id', userId!).single()
                            .then(({ data }) => {
                              if (data?.home_address) setDestination(data.home_address);
                            });
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition-all flex items-center gap-2",
                          hostMode === 'hosting'
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/30 hover:bg-primary/5"
                        )}
                      >
                        <Home className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium">I'm hosting</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setHostMode('visiting'); setHostUserId(null); setDestination(''); }}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition-all flex items-center gap-2",
                          hostMode === 'visiting'
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/30 hover:bg-primary/5"
                        )}
                      >
                        <Plane className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium">I'm visiting</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected chips */}
                {selectedFriends.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFriends.map(f => (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f)}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {f.name.split(' ')[0]}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search friends..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* Suggested */}
                {!searchQuery && suggestedFriends.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      <Sparkles className="h-3 w-3 inline mr-1" />Suggested
                    </p>
                    <div className="space-y-1">
                      {suggestedFriends.map(f => (
                        <FriendRow key={f.id} friend={f} selected={!!selectedFriends.find(s => s.id === f.id)} onToggle={() => toggleFriend(f)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Friend city picker for "I'm visiting" */}
                {proposalType === 'visit' && hostMode === 'visiting' && selectedFriends.length > 0 && Object.keys(friendHomeAddresses).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Visit whose city?
                    </p>
                    {selectedFriends.filter(f => f.friendUserId && friendHomeAddresses[f.friendUserId]).map(f => {
                      const addr = friendHomeAddresses[f.friendUserId!];
                      const isSelected = hostUserId === f.friendUserId;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            setHostUserId(f.friendUserId || null);
                            setDestination(addr);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "border-border hover:border-primary/30 hover:bg-primary/5"
                          )}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                            <AvatarFallback className="text-[8px]">{f.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{f.name.split(' ')[0]}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />{addr}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* All / filtered */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {searchQuery ? 'Results' : 'All friends'}
                  </p>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                    {filteredFriends.map(f => (
                      <FriendRow key={f.id} friend={f} selected={!!selectedFriends.find(s => s.id === f.id)} onToggle={() => toggleFriend(f)} />
                    ))}
                    {filteredFriends.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No friends found</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}


            {/* STEP 2: Month picker */}
            {step === 'months' && (
              <motion.div
                key="months"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-xs text-muted-foreground text-center">
                  Select the months you'd consider for this trip. Pick as many as you like — they don't need to be consecutive.
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {monthOptions.map(mo => {
                    const sel = selectedMonths.includes(mo.key);
                    const stats = monthStats[mo.key];
                    const hasStats = !!stats && !loadingMonthStats;
                    const freeRatio = hasStats && stats.totalWeekends > 0 ? stats.freeWeekends / stats.totalWeekends : 0;
                    // Color coding: green if mostly free, amber if mixed, red-ish if conflicts
                    const isGreat = hasStats && freeRatio >= 0.7 && stats.tripConflicts === 0;
                    const hasTripConflict = hasStats && stats.tripConflicts > 0;
                    return (
                      <motion.button
                        key={mo.key}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleMonth(mo.key)}
                        className={cn(
                          "relative rounded-xl border px-3 py-2.5 text-sm font-medium transition-all text-center flex flex-col items-center gap-1",
                          sel
                            ? isGreat
                              ? "border-chart-2 bg-chart-2/15 text-chart-2 ring-1 ring-chart-2/30"
                              : "border-primary bg-primary/10 text-primary"
                            : isGreat
                              ? "border-chart-2/40 bg-chart-2/5 hover:bg-chart-2/10 text-foreground"
                              : "border-border hover:border-primary/30 hover:bg-primary/5 text-foreground"
                        )}
                      >
                        <span>{mo.label}</span>
                        {hasStats && (
                          <span className={cn(
                            "text-[9px] font-medium leading-none",
                            isGreat ? "text-chart-2" : hasTripConflict ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {stats.freeWeekends}/{stats.totalWeekends} free
                            {stats.tripConflicts > 0 && ` · ${stats.tripConflicts} trip${stats.tripConflicts > 1 ? 's' : ''}`}
                          </span>
                        )}
                        {loadingMonthStats && (
                          <span className="h-2.5 w-12 rounded-full bg-muted animate-pulse" />
                        )}
                        {/* Dot indicator */}
                        {hasStats && (
                          <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                            {isGreat && <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />}
                            {hasTripConflict && <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {selectedMonths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {selectedMonths.sort().map(k => {
                      const mo = monthOptions.find(m => m.key === k);
                      return (
                        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
                          {mo?.label}
                          <button onClick={() => toggleMonth(k)}><X className="h-3 w-3" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: Weekend results */}
            {step === 'weekends' && (
              <motion.div
                key="weekends"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {loadingWeekends ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Analyzing availability across {selectedMonths.length} month{selectedMonths.length > 1 ? 's' : ''}...</p>
                  </div>
                ) : weekends.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Best weekends ({weekends.filter(w => !w.hasConflict).length} conflict-free)
                      </p>
                    </div>

                    {selectedWeekends.length > 0 && (
                      <p className="text-[10px] text-center text-primary font-medium">
                        {selectedWeekends.length}/5 selected
                      </p>
                    )}

                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {weekends.map((w, i) => (
                        <WeekendCard
                          key={w.fridayDate.toISOString()}
                          weekend={w}
                          index={i}
                          selected={isWeekendSelected(w)}
                          onToggle={() => toggleWeekend(w)}
                          participantCount={selectedFriends.length + 1}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="text-2xl">📅</span>
                    <p className="text-sm font-medium text-foreground">No weekends found</p>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      Try selecting different months or adding fewer friends.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 4: Confirmation */}
            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="space-y-4"
              >
                {/* Destination input */}
                {proposalType === 'trip' ? (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      Destination (optional)
                    </label>
                    <CityAutocomplete
                      value={destination}
                      onChange={setDestination}
                      placeholder="Where to?"
                      compact
                      types="(cities)"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                      {hostMode === 'hosting' ? 'Hosting in your city' : "Friend's city"}
                    </label>
                    {hostMode === 'hosting' && destination ? (
                      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{destination}</span>
                      </div>
                    ) : (
                      <CityAutocomplete
                        value={destination}
                        onChange={setDestination}
                        placeholder="Search for a city..."
                        compact
                        types="(cities)"
                      />
                    )}
                  </div>
                )}

                {/* Summary card */}
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{isVisit ? '🏠' : '✈️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-foreground">
                        {isVisit
                          ? (hostMode === 'hosting'
                            ? `Hosting in ${destination || 'your city'}`
                            : `Visit to ${destination || "friend's city"}`)
                          : (destination ? `Trip to ${destination}` : isSoloTrip ? 'Solo Trip' : 'Group Trip')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedWeekends.length} date option{selectedWeekends.length > 1 ? 's' : ''}
                        {selectedFriends.length > 0 ? ` with ${friendNamesStr}` : ' — solo trip'}
                      </p>
                    </div>
                  </div>

                  <div className="h-px bg-border" />

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {isSoloTrip ? 'Selected dates' : 'Proposed dates'}
                    </p>
                    {selectedWeekends
                      .sort((a, b) => a.fridayDate.getTime() - b.fridayDate.getTime())
                      .map((w, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">
                            {format(w.fridayDate, 'MMM d')} – {format(w.sundayDate, 'MMM d')}
                          </span>
                          <span className={cn(
                            "text-[10px] font-medium rounded-full px-2 py-0.5",
                            w.hasConflict
                              ? "bg-destructive/10 text-destructive"
                              : "bg-availability-available/10 text-availability-available"
                          )}>
                            {w.availPct}% free
                          </span>
                        </div>
                      ))}
                  </div>

                  {selectedFriends.length > 0 && (
                    <>
                      <div className="h-px bg-border" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">With</p>
                        <div className="flex -space-x-1.5">
                          {selectedFriends.slice(0, 6).map(f => (
                            <Avatar key={f.id} className="h-6 w-6 border-2 border-background">
                              <AvatarImage src={f.avatar || getElephantAvatar(f.name)} />
                              <AvatarFallback className="text-[7px]">{f.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {isVisit ? '🏠 Visit' : isSoloTrip ? '✈️ Confirmed' : '✈️ Proposed'}
                  </span>
                  <span className="text-muted-foreground">
                    {isSoloTrip ? '— trip will be created' : '— friends can vote on dates'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer buttons */}
        {step === 'friends' && (
          <DrawerFooter className="pt-2 space-y-1.5">
            {selectedFriends.length > 0 ? (
              <Button onClick={() => setStep('months')} className="w-full gap-2">
                Continue with {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''}
              </Button>
            ) : proposalType === 'trip' ? (
              <Button onClick={() => setStep('months')} variant="outline" className="w-full gap-2">
                Just me — solo trip
              </Button>
            ) : null}
            {proposalType === 'visit' && selectedFriends.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center">Select at least one friend for a visit</p>
            )}
          </DrawerFooter>
        )}

        {step === 'months' && selectedMonths.length > 0 && (
          <DrawerFooter className="pt-2">
            <Button onClick={() => setStep('weekends')} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Find best weekends
            </Button>
          </DrawerFooter>
        )}

        {step === 'weekends' && selectedWeekends.length > 0 && (
          <DrawerFooter className="pt-2">
            <Button onClick={() => setStep('confirm')} className="w-full gap-2">
              <Check className="h-4 w-4" />
              Review {selectedWeekends.length} option{selectedWeekends.length > 1 ? 's' : ''}
            </Button>
          </DrawerFooter>
        )}

        {step === 'confirm' && (
          <DrawerFooter className="pt-2">
            <Button onClick={isSoloTrip ? handleSoloSubmit : handleSubmit} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : isVisit ? <Home className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
              {isSoloTrip ? 'Create Trip' : isVisit ? 'Share Visit Options →' : 'Share Trip Options →'}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// --- Sub-components ---

function FriendRow({ friend, selected, onToggle }: { friend: Friend; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border hover:border-primary/20 hover:bg-muted/50"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={friend.avatar || getElephantAvatar(friend.name)} />
        <AvatarFallback className="text-[10px]">{getInitials(friend.name)}</AvatarFallback>
      </Avatar>
      <span className="flex-1 text-sm font-medium text-foreground truncate">{friend.name}</span>
      {selected && (
        <span className="shrink-0 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </span>
      )}
    </button>
  );
}

function WeekendCard({
  weekend, index, selected, onToggle, participantCount,
}: {
  weekend: WeekendOption;
  index: number;
  selected: boolean;
  onToggle: () => void;
  participantCount: number;
}) {
  const label = `${format(weekend.fridayDate, 'EEE, MMM d')} – ${format(weekend.sundayDate, 'MMM d')}`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
          : weekend.hasConflict
            ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
            : "border-border hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {weekend.hasConflict && (
            <span className="text-[10px] font-medium text-destructive">
              ⚠️ Trip conflict
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "text-[10px] font-medium rounded-full px-2 py-0.5",
          weekend.availPct >= 70
            ? "bg-availability-available/10 text-availability-available"
            : weekend.availPct >= 40
              ? "bg-muted text-foreground"
              : "bg-muted text-muted-foreground"
        )}>
          {weekend.availPct}% free
        </span>
        {selected && (
          <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </span>
        )}
      </div>
    </motion.button>
  );
}
export default GuidedTripSheet;
