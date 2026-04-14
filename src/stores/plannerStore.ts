import { create } from 'zustand';
import { Plan, Friend, DayAvailability, Vibe, TimeSlot, LocationStatus, ActivityType, VibeType, PlanStatus } from '@/types/planner';
import { addDays, startOfWeek, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getUserTimezone, convertTimeBetweenTimezones, getTimeSlotForTime, getTimeSlotMidpoint } from '@/lib/timezone';

// Shape returned by the get_dashboard_data RPC
interface DashboardData {
  own_plans: any[];
  participated_plans: any[];
  plan_participants: Array<{
    plan_id: string;
    friend_id: string;
    status: string;
    role: string;
    responded_at: string | null;
  }>;
  participant_profiles: Array<{
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  outgoing_friendships: Array<{
    id: string;
    user_id: string;
    friend_user_id: string | null;
    friend_name: string;
    friend_email: string | null;
    status: string;
    is_pod_member: boolean;
    created_at: string;
    updated_at: string;
  }>;
  outgoing_friend_profiles: Array<{
    user_id: string;
    avatar_url: string | null;
  }>;
  incoming_friendships: Array<{
    id: string;
    user_id: string;
    friend_user_id: string | null;
    friend_name: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  incoming_friend_profiles: Array<{
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  availability: Array<{
    date: string;
    early_morning: boolean;
    late_morning: boolean;
    early_afternoon: boolean;
    late_afternoon: boolean;
    evening: boolean;
    late_night: boolean;
    location_status: string | null;
    trip_location: string | null;
    vibe: string | null;
    slot_location_early_morning: string | null;
    slot_location_late_morning: string | null;
    slot_location_early_afternoon: string | null;
    slot_location_late_afternoon: string | null;
    slot_location_evening: string | null;
    slot_location_late_night: string | null;
  }>;
  profile: {
    current_vibe: string | null;
    location_status: string | null;
    custom_vibe_tags: string[] | null;
    vibe_gif_url: string | null;
    default_work_days: string[] | null;
    default_work_start_hour: number | null;
    default_work_end_hour: number | null;
    default_availability_status: string | null;
    default_vibes: string[] | null;
    home_address: string | null;
    timezone: string | null;
  } | null;
}

interface DefaultAvailabilitySettings {
  workDays: string[];
  workStartHour: number;
  workEndHour: number;
  defaultStatus: 'free' | 'unavailable';
  defaultVibes: string[];
}

// Helper to build a date-string-keyed map from an availability array
const buildAvailabilityMap = (availability: DayAvailability[]): Record<string, DayAvailability> => {
  const map: Record<string, DayAvailability> = {};
  for (const a of availability) {
    map[format(a.date, 'yyyy-MM-dd')] = a;
  }
  return map;
};

interface PlannerState {
  plans: Plan[];
  friends: Friend[];
  availability: DayAvailability[];
  availabilityMap: Record<string, DayAvailability>;
  currentVibe: Vibe | null;
  locationStatus: LocationStatus;
  isLoading: boolean;
  userId: string | null;
  lastFetchedAt: number | null;
  defaultSettings: DefaultAvailabilitySettings | null;
  homeAddress: string | null;
  userTimezone: string;
  
  setUserId: (userId: string | null) => void;
  loadAllData: (force?: boolean) => Promise<void>;
  forceRefresh: () => Promise<void>;
  loadFriends: () => Promise<void>;
  loadPlans: () => Promise<void>;
  loadProfileAndAvailability: () => Promise<void>;
  
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt'>) => Promise<void>;
  updatePlan: (id: string, updates: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  proposePlan: (proposal: {
    recipientFriendId: string;
    activity: ActivityType | string;
    date: Date;
    timeSlot: TimeSlot;
    title?: string;
    location?: string;
    note?: string;
  }) => Promise<void>;
  respondToProposal: (planId: string, participantRowId: string, response: 'accepted' | 'declined') => Promise<void>;
  
  addFriend: (friend: Omit<Friend, 'id'>) => Promise<void>;
  updateFriend: (id: string, updates: Partial<Friend>) => Promise<void>;
  acceptFriendRequest: (friendshipId: string, requesterUserId: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  
  setAvailability: (date: Date, slot: TimeSlot, available: boolean) => Promise<void>;
  setLocationStatus: (status: LocationStatus, date?: Date) => Promise<void>;
  getLocationStatusForDate: (date: Date) => LocationStatus;
  setVibeForDate: (date: Date, vibe: VibeType | null) => Promise<void>;
  getVibeForDate: (date: Date) => VibeType | null;
  setVibe: (vibe: Vibe | null) => Promise<void>;
  addCustomVibe: (tag: string) => Promise<void>;
  removeCustomVibe: (tag: string) => Promise<void>;
  
  loadAvailabilityForRange: (startDate: Date, endDate: Date) => Promise<void>;
  initializeWeekAvailability: () => Promise<void>;
}

// Map time slots to hour ranges
const TIME_SLOT_HOURS: Record<TimeSlot, { start: number; end: number }> = {
  'early-morning': { start: 6, end: 9 },
  'late-morning': { start: 9, end: 12 },
  'early-afternoon': { start: 12, end: 15 },
  'late-afternoon': { start: 15, end: 18 },
  'evening': { start: 18, end: 22 },
  'late-night': { start: 22, end: 26 }, // 26 = 2am next day
};

const createDefaultAvailability = (date: Date, settings?: DefaultAvailabilitySettings | null): DayAvailability => {
  // Determine which day of week this date is
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
  const isWorkDay = settings?.workDays?.includes(dayOfWeek) ?? false;
  
  // Default all slots based on user preference
  const defaultFree = settings?.defaultStatus !== 'unavailable';
  
  // Calculate which slots overlap with work hours
  const slots: Record<TimeSlot, boolean> = {
    'early-morning': defaultFree,
    'late-morning': defaultFree,
    'early-afternoon': defaultFree,
    'late-afternoon': defaultFree,
    'evening': defaultFree,
    'late-night': defaultFree,
  };
  
  // If it's a work day, mark work hour slots as unavailable
  if (isWorkDay && settings) {
    const workStart = settings.workStartHour;
    const workEnd = settings.workEndHour;
    
    for (const [slot, hours] of Object.entries(TIME_SLOT_HOURS)) {
      // Check if this slot overlaps with work hours
      const slotOverlapsWork = hours.start < workEnd && hours.end > workStart;
      if (slotOverlapsWork) {
        slots[slot as TimeSlot] = false;
      }
    }
  }
  
  return {
    date,
    slots,
    locationStatus: 'home',
  };
};

export const usePlannerStore = create<PlannerState>((set, get) => ({
  plans: [],
  friends: [],
  availability: [],
  availabilityMap: {},
  currentVibe: null,
  locationStatus: 'home',
  isLoading: true,
  userId: null,
  lastFetchedAt: null,
  defaultSettings: null,
  homeAddress: null,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  
  setUserId: (userId) => set({ userId }),
  
  loadAllData: async (force) => {
    const { userId, lastFetchedAt } = get();
    if (!userId) {
      set({ isLoading: false });
      return;
    }

    // Skip if fetched less than 30s ago (unless forced)
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < 30_000) {
      return;
    }
    
    set({ isLoading: true });
    
    try {
      // ── Single RPC call — replaces the 4-wave waterfall ──────────────────
      // Retry up to 2 times on network failures
      let rpcData: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase.rpc('get_dashboard_data' as any, {
          p_user_id: userId,
        });
        if (!error) {
          rpcData = data;
          break;
        }
        lastError = error;
        console.warn(`get_dashboard_data attempt ${attempt + 1} failed:`, error.message);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }

      if (!rpcData) {
        console.error('get_dashboard_data failed after retries:', lastError);
        // Fall back to individual loaders so partial data can still load
        try {
          await Promise.all([
            get().loadFriends(),
            get().loadPlans(),
            get().loadProfileAndAvailability(),
          ]);
        } catch (fallbackErr) {
          console.error('Fallback loaders also failed:', fallbackErr);
        }
        set({ isLoading: false, lastFetchedAt: Date.now() });
        return;
      }

      const d = rpcData as unknown as DashboardData;

      // ── Rebuild lookup maps (same logic as before, just from RPC data) ───

      // Plan participants map: plan_id → participant rows
      const participantsMap: Record<string, { friend_id: string; status: string; role: string; responded_at: string | null }[]> = {};
      for (const pp of (d.plan_participants || [])) {
        if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
        participantsMap[pp.plan_id].push({
          friend_id: pp.friend_id,
          status: pp.status,
          role: pp.role,
          responded_at: pp.responded_at,
        });
      }

      // Participant profiles map: user_id → { display_name, avatar_url }
      const profilesMap: Record<string, string> = {};
      const profileAvatarsMap: Record<string, string | null> = {};
      for (const p of (d.participant_profiles || [])) {
        if (p.user_id) {
          profilesMap[p.user_id] = p.display_name || 'Friend';
          profileAvatarsMap[p.user_id] = p.avatar_url;
        }
      }

      // Outgoing friend avatar map: user_id → avatar_url
      const outgoingAvatarMap = new Map<string, string | null>(
        (d.outgoing_friend_profiles || []).map(p => [p.user_id, p.avatar_url])
      );

      // Incoming friend profiles map: user_id → { display_name, avatar_url }
      const incomingProfilesMap = new Map(
        (d.incoming_friend_profiles || []).map(p => [p.user_id, p])
      );

      // ── Profile ──────────────────────────────────────────────────────────
      const profile = d.profile;
      const homeAddr = profile?.home_address || null;
      const explicitTz = profile?.timezone || null;

      // ── Availability data (30-day window from RPC) ───────────────────────
      const availData = d.availability || [];

      // Derive timezone from today's availability row (same logic as before)
      const todayStrForTz = format(new Date(), 'yyyy-MM-dd');
      const todayAvailRaw = availData.find(a => a.date === todayStrForTz);
      const todayLocStatus = (todayAvailRaw?.location_status as LocationStatus) || 'home';
      const todayTripLoc = todayAvailRaw?.trip_location || undefined;
      const viewerTimezone = getUserTimezone(todayLocStatus, homeAddr, todayTripLoc, explicitTz);

      // ── Merge own + participated plans and dedupe (same logic as before) ──
      const ownPlansData = d.own_plans || [];
      const participatedPlansData = d.participated_plans || [];

      const ownIds = new Set(ownPlansData.map((p: any) => p.id));
      const ownHangKeys = new Set(
        ownPlansData
          .filter((p: any) => p.source === 'hang-request')
          .map((p: any) => `${p.date}|${p.time_slot}`)
      );
      const plansData = [
        ...ownPlansData,
        ...participatedPlansData.filter((p: any) => {
          if (ownIds.has(p.id)) return false;
          if (p.source === 'hang-request' && ownHangKeys.has(`${p.date}|${p.time_slot}`)) return false;
          return true;
        }),
      ];

      // ── Map raw plan rows to Plan objects (same timezone conversion logic) ─
      const plans: Plan[] = plansData.map((p: any) => {
        const allPps = participantsMap[p.id] || [];
        const myParticipation = allPps.find(pp => pp.friend_id === userId);
        const myRole = p.user_id === userId
          ? 'participant'
          : (myParticipation?.role as 'participant' | 'subscriber') || 'participant';
        const rawPps = allPps.filter(pp => pp.friend_id !== userId);
        const pps = [...rawPps];
        if (p.user_id !== userId && !pps.some(pp => pp.friend_id === p.user_id)) {
          pps.push({ friend_id: p.user_id, status: 'accepted', role: 'participant', responded_at: null });
        }
        const planDateRaw = new Date(p.date);
        const planYear = planDateRaw.getUTCFullYear();
        const planMonth = planDateRaw.getUTCMonth();
        const planDay = planDateRaw.getUTCDate();
        let normalizedPlanDate = new Date(planYear, planMonth, planDay);

        let effectiveTimeSlot = p.time_slot as TimeSlot;
        let effectiveStartTime: string | undefined = p.start_time || undefined;
        let effectiveEndTime: string | undefined = p.end_time || undefined;

        const sourceTimezone = p.source_timezone;
        if (sourceTimezone && sourceTimezone !== viewerTimezone && p.user_id !== userId) {
          if (effectiveStartTime) {
            const converted = convertTimeBetweenTimezones(effectiveStartTime, normalizedPlanDate, sourceTimezone, viewerTimezone);
            effectiveStartTime = converted.time;
            if (converted.dayOffset !== 0) normalizedPlanDate = addDays(normalizedPlanDate, converted.dayOffset);
            effectiveTimeSlot = getTimeSlotForTime(converted.time) as TimeSlot;
          } else {
            const midpoint = getTimeSlotMidpoint(p.time_slot);
            const converted = convertTimeBetweenTimezones(midpoint, normalizedPlanDate, sourceTimezone, viewerTimezone);
            effectiveTimeSlot = getTimeSlotForTime(converted.time) as TimeSlot;
            if (converted.dayOffset !== 0) normalizedPlanDate = addDays(normalizedPlanDate, converted.dayOffset);
          }
          if (effectiveEndTime) {
            const convertedEnd = convertTimeBetweenTimezones(effectiveEndTime, new Date(planYear, planMonth, planDay), sourceTimezone, viewerTimezone);
            effectiveEndTime = convertedEnd.time;
          }
        }

        return {
          id: p.id,
          userId: p.user_id,
          title: p.title,
          activity: p.activity as ActivityType,
          date: normalizedPlanDate,
          endDate: p.end_date ? (() => {
            const ed = new Date(p.end_date);
            return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate());
          })() : undefined,
          timeSlot: effectiveTimeSlot,
          duration: p.duration,
          startTime: effectiveStartTime,
          endTime: effectiveEndTime,
          location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
          notes: p.notes || undefined,
          status: p.status as PlanStatus || 'confirmed',
          feedVisibility: p.feed_visibility || 'private',
          participants: pps.map(pp => ({
            id: pp.friend_id,
            name: profilesMap[pp.friend_id] || 'Friend',
            avatar: profileAvatarsMap[pp.friend_id] || undefined,
            friendUserId: pp.friend_id,
            status: 'connected' as const,
            role: (pp.role as 'participant' | 'subscriber') || 'participant',
            rsvpStatus: pp.status as string || 'invited',
            respondedAt: pp.responded_at ? new Date(pp.responded_at) : undefined,
          })),
          myRole,
          myRsvpStatus: p.user_id === userId ? undefined : (myParticipation?.status as string || 'invited'),
          recurringPlanId: p.recurring_plan_id || undefined,
          proposedBy: p.proposed_by || undefined,
          createdAt: new Date(p.created_at),
        };
      });

      // ── Map friendships (same dedup logic as before) ──────────────────────
      const outgoingFriends: Friend[] = (d.outgoing_friendships || []).map(f => ({
        id: f.id,
        name: f.friend_name,
        email: f.friend_email || undefined,
        avatar: f.friend_user_id ? (outgoingAvatarMap.get(f.friend_user_id) || undefined) : undefined,
        friendUserId: f.friend_user_id || undefined,
        status: f.status as 'connected' | 'pending' | 'invited',
        isIncoming: false,
        isPodMember: f.is_pod_member || false,
      }));

      const incomingFriends: Friend[] = (d.incoming_friendships || []).map(f => {
        const prof = incomingProfilesMap.get(f.user_id);
        return {
          id: f.id,
          name: prof?.display_name || 'Someone',
          avatar: prof?.avatar_url || undefined,
          friendUserId: f.user_id,
          status: f.status as 'connected' | 'pending' | 'invited',
          isIncoming: true,
        };
      });

      // Dedup outgoing (same logic as before)
      const dedupeOutgoing = (list: Friend[]): Friend[] => {
        const byUserId = new Map<string, Friend>();
        const noUserId: Friend[] = [];
        const statusPriority: Record<string, number> = { connected: 3, pending: 2, invited: 1 };
        for (const f of list) {
          if (!f.friendUserId) { noUserId.push(f); continue; }
          const existing = byUserId.get(f.friendUserId);
          if (!existing || (statusPriority[f.status] || 0) > (statusPriority[existing.status] || 0)) {
            byUserId.set(f.friendUserId, f);
          }
        }
        return [...byUserId.values(), ...noUserId.filter(f => {
          if (f.status !== 'invited' || !f.email) return true;
          return !byUserId.size;
        })];
      };

      const dedupedOutgoing = dedupeOutgoing(outgoingFriends);

      // Global dedup across outgoing + incoming (same logic as before)
      const statusPriority: Record<string, number> = { connected: 3, pending: 2, invited: 1 };
      const globalByUserId = new Map<string, Friend>();
      const noUserId: Friend[] = [];
      for (const f of [...dedupedOutgoing, ...incomingFriends]) {
        if (!f.friendUserId) { noUserId.push(f); continue; }
        const existing = globalByUserId.get(f.friendUserId);
        if (!existing || (statusPriority[f.status] || 0) > (statusPriority[existing.status] || 0)) {
          if (existing && !f.isIncoming && existing.isIncoming) {
            globalByUserId.set(f.friendUserId, { ...f });
          } else if (existing && f.isIncoming && !existing.isIncoming) {
            globalByUserId.set(f.friendUserId, { ...existing, status: f.status });
          } else {
            globalByUserId.set(f.friendUserId, f);
          }
        }
      }
      const friends = [...globalByUserId.values(), ...noUserId];

      // ── Process availability with default settings (same logic as before) ─
      const customTags = profile?.custom_vibe_tags || [];
      const vibeGifUrl = profile?.vibe_gif_url || undefined;
      const currentVibe = profile?.current_vibe
        ? {
            type: profile.current_vibe as VibeType,
            customTags: profile.current_vibe === 'custom' ? customTags : undefined,
            gifUrl: vibeGifUrl,
          }
        : null;

      const defaultSettings: DefaultAvailabilitySettings = {
        workDays: profile?.default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        workStartHour: profile?.default_work_start_hour ?? 9,
        workEndHour: profile?.default_work_end_hour ?? 17,
        defaultStatus: (profile?.default_availability_status as 'free' | 'unavailable') || 'free',
        defaultVibes: profile?.default_vibes || [],
      };

      // Build availability map from RPC data (~42-day window)
      const availDataMap = new Map<string, typeof availData[0]>();
      for (const a of availData) {
        availDataMap.set(a.date, a);
      }

      // Generate availability for the RPC window only (~42 days: -7 to +35)
      const start = addDays(new Date(), -7);
      const windowDays = 42;
      const allDates = Array.from({ length: windowDays }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
      const availabilityWithDefaults: DayAvailability[] = allDates.map((dateStr, i) => {
        const existing = availDataMap.get(dateStr);
        const date = addDays(start, i);
        if (existing) {
          const slotLocs: Record<string, string | null> = {};
          let hasSlotLocs = false;
          const slotMap: Record<string, string> = {
            'early-morning': 'slot_location_early_morning',
            'late-morning': 'slot_location_late_morning',
            'early-afternoon': 'slot_location_early_afternoon',
            'late-afternoon': 'slot_location_late_afternoon',
            'evening': 'slot_location_evening',
            'late-night': 'slot_location_late_night',
          };
          for (const [slot, col] of Object.entries(slotMap)) {
            const val = (existing as any)[col] as string | null;
            if (val) { slotLocs[slot] = val; hasSlotLocs = true; }
          }
          return {
            date,
            slots: {
              'early-morning':    existing.early_morning  ?? true,
              'late-morning':     existing.late_morning   ?? true,
              'early-afternoon':  existing.early_afternoon ?? true,
              'late-afternoon':   existing.late_afternoon  ?? true,
              'evening':          existing.evening        ?? true,
              'late-night':       existing.late_night     ?? true,
            },
            locationStatus: (existing.location_status as LocationStatus) || 'home',
            tripLocation:   existing.trip_location || undefined,
            vibe:           existing.vibe as VibeType | null || null,
            ...(hasSlotLocs ? { slotLocations: slotLocs } : {}),
          };
        }
        return createDefaultAvailability(date, defaultSettings);
      });

      const availabilityMap = buildAvailabilityMap(availabilityWithDefaults);

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayAvail = availabilityMap[todayStr];
      const todayLocationStatus = todayAvail?.locationStatus || 'home';

      // ── Commit to store ───────────────────────────────────────────────────
      set({
        plans,
        friends,
        availability: availabilityWithDefaults,
        availabilityMap,
        currentVibe,
        locationStatus: todayLocationStatus,
        defaultSettings,
        homeAddress: homeAddr,
        userTimezone: viewerTimezone,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });

    } catch (error) {
      console.error('loadAllData error:', error);
      set({ isLoading: false });
    }
  },

  forceRefresh: async () => {
    set({ lastFetchedAt: null });
    await get().loadAllData();
  },
  
  addPlan: async (plan) => {
    const { userId } = get();
    if (!userId) return;
    
    const locationStr = plan.location ? plan.location.name : null;
    
    // Cast date to noon UTC to prevent timezone day-shift issues
    const dateStr = format(plan.date, 'yyyy-MM-dd');
    const noonUtcDate = `${dateStr}T12:00:00+00:00`;
    
    const endDateStr = plan.endDate ? format(plan.endDate, 'yyyy-MM-dd') : null;
    const noonUtcEndDate = endDateStr ? `${endDateStr}T12:00:00+00:00` : null;
    
    const { userTimezone } = get();
    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        title: plan.title,
        activity: plan.activity,
        date: noonUtcDate,
        end_date: noonUtcEndDate,
        time_slot: plan.timeSlot,
        duration: plan.duration,
        start_time: plan.startTime || null,
        end_time: plan.endTime || null,
        location: locationStr,
        notes: plan.notes,
        status: (plan.participants && plan.participants.length > 0 && (!plan.status || plan.status === 'confirmed'))
          ? 'proposed'
          : (plan.status || 'confirmed'),
        source_timezone: userTimezone,
        feed_visibility: plan.feedVisibility || 'private',
      } as any)
      .select()
      .single();
    
    if (error) {
      console.error('Error adding plan:', error);
      return;
    }
    
    const newPlanDateRaw = new Date(data.date);
    const newPlan: Plan = {
      id: data.id,
      title: data.title,
      activity: data.activity as ActivityType,
      date: new Date(newPlanDateRaw.getUTCFullYear(), newPlanDateRaw.getUTCMonth(), newPlanDateRaw.getUTCDate()),
      endDate: (data as any).end_date ? (() => {
        const ed = new Date((data as any).end_date);
        return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate());
      })() : undefined,
      timeSlot: data.time_slot as TimeSlot,
      duration: data.duration,
      startTime: (data as any).start_time || undefined,
      endTime: (data as any).end_time || undefined,
      location: data.location ? { id: data.id, name: data.location, address: '' } : undefined,
      notes: data.notes || undefined,
      status: (data as any).status as PlanStatus || 'confirmed',
      feedVisibility: (data as any).feed_visibility || 'private',
      participants: plan.participants || [],
      createdAt: new Date(data.created_at),
    };
    
    // Insert participants into plan_participants table
    if (plan.participants && plan.participants.length > 0) {
      const participantRows = plan.participants
        .filter(p => p.friendUserId)
        .map(p => ({
          plan_id: data.id,
          friend_id: p.friendUserId!,
          status: 'invited',
          role: p.role || 'participant',
        }));
      
      if (participantRows.length > 0) {
        await supabase.from('plan_participants').insert(participantRows);

        // Send push notifications to invited participants (single batch call)
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).single();
          const senderName = profile?.display_name || 'Someone';

          fetch(`https://${projectId}.supabase.co/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_ids: participantRows.map(r => r.friend_id),
              title: 'New Plan Invite! 📅',
              body: `${senderName} invited you to "${plan.title}"`,
              url: `/plan/${data.id}`,
            }),
          }).catch(() => {});
        } catch (err) {
          console.error('Push notification error:', err);
        }
      }
    }
    
    set((state) => ({ plans: [...state.plans, newPlan] }));
    
    // Auto-block the availability slot for this plan (only for confirmed plans, not proposed/tentative)
    const effectiveStatus = (plan.participants && plan.participants.length > 0 && (!plan.status || plan.status === 'confirmed'))
      ? 'proposed' : (plan.status || 'confirmed');
    if (effectiveStatus === 'confirmed') {
      const slotColumn = plan.timeSlot.replace('-', '_');
      await supabase
        .from('availability')
        .upsert({
          user_id: userId,
          date: dateStr,
          [slotColumn]: false,
        }, { onConflict: 'user_id,date' });
      
      // Update local availability state
      const { availability, availabilityMap, defaultSettings } = get();
      const existing = availabilityMap[dateStr];
      if (existing) {
        const updatedEntry = {
          ...existing,
          slots: { ...existing.slots, [plan.timeSlot]: false },
        };
        const updated = availability.map(a => format(a.date, 'yyyy-MM-dd') === dateStr ? updatedEntry : a);
        set({ availability: updated, availabilityMap: { ...availabilityMap, [dateStr]: updatedEntry } });
      } else {
        const newAvailability = createDefaultAvailability(plan.date, defaultSettings);
        newAvailability.slots[plan.timeSlot] = false;
        set({ 
          availability: [...availability, newAvailability],
          availabilityMap: { ...availabilityMap, [dateStr]: newAvailability },
        });
      }
    }
  },
  
  updatePlan: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.activity) dbUpdates.activity = updates.activity;
    if (updates.date) {
      const dateStr = format(updates.date, 'yyyy-MM-dd');
      dbUpdates.date = `${dateStr}T12:00:00+00:00`;
    }
    if (updates.endDate !== undefined) {
      dbUpdates.end_date = updates.endDate ? `${format(updates.endDate, 'yyyy-MM-dd')}T12:00:00+00:00` : null;
    }
    if (updates.timeSlot) dbUpdates.time_slot = updates.timeSlot;
    if (updates.duration) dbUpdates.duration = updates.duration;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime || null;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime || null;
    if (updates.location !== undefined) dbUpdates.location = updates.location?.name || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.feedVisibility !== undefined) dbUpdates.feed_visibility = updates.feedVisibility;

    // Mark imported plans as manually edited so calendar re-sync won't overwrite
    // Check source from DB since Plan type doesn't carry it
    const { data: planRow } = await supabase.from('plans').select('source').eq('id', id).single();
    if (planRow?.source && (planRow.source === 'gcal' || planRow.source === 'ical')) {
      dbUpdates.manually_edited = true;
    }

    const { error } = await supabase
      .from('plans')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating plan:', error);
      return;
    }
    
    // Sync participants if provided
    if (updates.participants) {
      // Diff-based upsert: only insert new and delete removed, preserving existing RSVP status
      const { data: existingParticipants } = await supabase
        .from('plan_participants')
        .select('id, friend_id, status, role, responded_at')
        .eq('plan_id', id);

      const existingMap = new Map((existingParticipants || []).map(p => [p.friend_id, p]));
      const desiredIds = new Set(
        updates.participants.filter(p => p.friendUserId).map(p => p.friendUserId!)
      );

      // Delete removed participants
      const toDelete = (existingParticipants || []).filter(p => !desiredIds.has(p.friend_id));
      if (toDelete.length > 0) {
        await supabase.from('plan_participants').delete().in('id', toDelete.map(p => p.id));
      }

      // Insert only new participants
      const toInsert = updates.participants
        .filter(p => p.friendUserId && !existingMap.has(p.friendUserId))
        .map(p => ({
          plan_id: id,
          friend_id: p.friendUserId!,
          status: 'invited',
          role: p.role || 'participant',
        }));

      if (toInsert.length > 0) {
        await supabase.from('plan_participants').insert(toInsert);
      }
    }
    
    set((state) => ({
      plans: state.plans.map((p) => p.id === id ? { ...p, ...updates } : p),
    }));
  },
  
  deletePlan: async (id) => {
    const { userId, plans: currentPlans, availability, defaultSettings } = get();
    const planToDelete = currentPlans.find(p => p.id === id);
    
    const isOwner = !planToDelete?.userId || planToDelete.userId === userId;
    
    if (isOwner) {
      // Owner: delete participants then the plan itself
      await supabase
        .from('plan_participants')
        .delete()
        .eq('plan_id', id);
      
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting plan:', error);
        return;
      }
    } else {
      // Non-owner: update participation status to 'declined'
      const { error } = await supabase
        .from('plan_participants')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('plan_id', id)
        .eq('friend_id', userId!);
      
      if (error) {
        console.error('Error declining plan:', error);
        return;
      }
    }
    
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
    }));
    
    // Restore availability slot if no other plans occupy it
    if (planToDelete && userId) {
      const dateStr = format(planToDelete.date, 'yyyy-MM-dd');
      const remainingPlans = currentPlans.filter(
        p => p.id !== id && 
        format(p.date, 'yyyy-MM-dd') === dateStr && 
        p.timeSlot === planToDelete.timeSlot
      );
      
      if (remainingPlans.length === 0) {
        const slotColumn = planToDelete.timeSlot.replace('-', '_');
        await supabase
          .from('availability')
          .upsert({
            user_id: userId,
            date: dateStr,
            [slotColumn]: true,
          }, { onConflict: 'user_id,date' });
        
        const existingEntry = get().availabilityMap[dateStr];
        if (existingEntry) {
          const updatedEntry = {
            ...existingEntry,
            slots: { ...existingEntry.slots, [planToDelete.timeSlot]: true },
          };
          const updated = get().availability.map(a => format(a.date, 'yyyy-MM-dd') === dateStr ? updatedEntry : a);
          set({ availability: updated, availabilityMap: { ...get().availabilityMap, [dateStr]: updatedEntry } });
        }
      }
    }
  },

  proposePlan: async (proposal) => {
    const { userId, userTimezone } = get();
    if (!userId) return;

    const dateStr = format(proposal.date, 'yyyy-MM-dd');
    const noonUtcDate = `${dateStr}T12:00:00+00:00`;

    const activityConfig = (await import('@/types/planner')).ACTIVITY_CONFIG[proposal.activity as ActivityType];
    const autoTitle = proposal.title || (activityConfig ? activityConfig.label : proposal.activity);

    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        title: autoTitle,
        activity: proposal.activity,
        date: noonUtcDate,
        time_slot: proposal.timeSlot,
        duration: 60,
        location: proposal.location || null,
        notes: proposal.note || null,
        status: 'proposed',
        proposed_by: userId,
        feed_visibility: 'private',
        source_timezone: userTimezone,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('proposePlan error:', error);
      const { toast } = await import('sonner');
      toast.error('Could not send proposal. Try again.');
      return;
    }

    // Insert participant row for the recipient
    await supabase.from('plan_participants').insert({
      plan_id: data.id,
      friend_id: proposal.recipientFriendId,
      status: 'invited',
      role: 'participant',
    });

    // Push notification
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .single();
      const senderName = senderProfile?.display_name || 'Someone';
      const { TIME_SLOT_LABELS: TSL } = await import('@/types/planner');
      const timeLabel = TSL[proposal.timeSlot]?.label || proposal.timeSlot;
      const dateLabel = format(proposal.date, 'EEE, MMM d');

      fetch(`https://${projectId}.supabase.co/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: proposal.recipientFriendId,
          title: `${senderName} wants to make plans 🎉`,
          body: `${activityConfig?.label || proposal.activity} · ${dateLabel} · ${timeLabel}`,
          url: `/notifications`,
          icon: '/icon-192.png',
        }),
      }).catch(() => {});
    } catch (e) {
      console.error('Push notification error in proposePlan:', e);
    }

    // Reload local data so the new plan appears in the sender's plan list
    await get().loadAllData();
  },

  respondToProposal: async (planId, participantRowId, response) => {
    if (response === 'declined') {
      await supabase
        .from('plan_participants')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', participantRowId);
      return;
    }

    // Accept: update plan status to confirmed, update participant status to accepted
    await supabase
      .from('plans')
      .update({ status: 'confirmed' })
      .eq('id', planId);

    await supabase
      .from('plan_participants')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', participantRowId);

    await get().loadAllData();
  },

  addFriend: async (friend) => {
    const { userId } = get();
    if (!userId) return;
    
    // Check if a friendship already exists for this user
    if (friend.friendUserId) {
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .eq('user_id', userId)
        .eq('friend_user_id', friend.friendUserId)
        .maybeSingle();
      
      if (existing) {
        console.log('Friendship already exists:', existing.id, existing.status);
        return;
      }
    }
    
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id: userId,
        friend_name: friend.name,
        friend_email: friend.email || null,
        friend_user_id: friend.friendUserId || null,
        status: friend.status,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding friend:', error);
      return;
    }

    // Send push notification for friend request
    if (friend.friendUserId && friend.status === 'pending') {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).single();
        const senderName = profile?.display_name || 'Someone';

        fetch(`https://${projectId}.supabase.co/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: friend.friendUserId,
            title: 'New Friend Request! 🎉',
            body: `${senderName} wants to connect with you`,
            url: '/notifications',
          }),
        }).catch(() => {});
      } catch (err) {
        console.error('Push notification error:', err);
      }
    }
    
    const newFriend: Friend = {
      id: data.id,
      name: data.friend_name,
      email: data.friend_email || undefined,
      friendUserId: data.friend_user_id || undefined,
      status: data.status as 'connected' | 'pending' | 'invited',
    };
    
    set((state) => ({ friends: [...state.friends, newFriend] }));
  },
  
  updateFriend: async (id, updates) => {
    const { userId } = get();
    const friend = get().friends.find(f => f.id === id);
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name) dbUpdates.friend_name = updates.name;
    if (updates.email !== undefined) dbUpdates.friend_email = updates.email;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.isPodMember !== undefined) dbUpdates.is_pod_member = updates.isPodMember;
    
    // For incoming friends, the friendship row is owned by the other user,
    // so we can't update it (RLS). Instead, find or create our own row.
    let targetId = id;
    if (friend?.isIncoming && userId && friend.friendUserId) {
      // Check if we already have an outgoing row for this friend
      const { data: existingRow } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', userId)
        .eq('friend_user_id', friend.friendUserId)
        .maybeSingle();
      
      if (existingRow) {
        targetId = existingRow.id;
      } else {
        // Create our own reciprocal friendship row
        const { data: newRow, error: insertError } = await supabase
          .from('friendships')
          .insert({
            user_id: userId,
            friend_user_id: friend.friendUserId,
            friend_name: friend.name,
            status: 'connected',
            is_pod_member: updates.isPodMember ?? false,
          })
          .select()
          .single();
        
        if (insertError || !newRow) {
          console.error('Error creating reciprocal friendship:', insertError);
          return;
        }
        
        // Update local state: replace the incoming friend entry with the new outgoing one
        set((state) => ({
          friends: state.friends.map((f) => f.id === id ? { ...f, ...updates, id: newRow.id, isIncoming: false } : f),
        }));
        return;
      }
    }
    
    const { error } = await supabase
      .from('friendships')
      .update(dbUpdates)
      .eq('id', targetId);
    
    if (error) {
      console.error('Error updating friend:', error);
      return;
    }
    
    set((state) => ({
      friends: state.friends.map((f) => f.id === id ? { ...f, ...updates } : f),
    }));
  },
  
  acceptFriendRequest: async (friendshipId: string, requesterUserId: string) => {
    const { userId } = get();
    if (!userId) return;
    
    // Use security definer function to atomically accept and create reciprocal record
    const { error } = await supabase.rpc('accept_friend_request', {
      p_friendship_id: friendshipId,
      p_requester_user_id: requesterUserId,
    });
    
    if (error) {
      console.error('Error accepting friend request:', error);
      return;
    }
    
    // Update local state - change the incoming request to connected
    set((state) => ({
      friends: state.friends.map((f) => 
        f.id === friendshipId ? { ...f, status: 'connected' as const } : f
      ),
    }));
  },
  
  removeFriend: async (id) => {
    const { error } = await supabase
      .rpc('remove_friendship', { p_friendship_id: id });
    
    if (error) {
      console.error('Error removing friend:', error);
      return;
    }
    
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== id),
    }));
  },
  
  setAvailability: async (date, slot, available) => {
    const { userId, availability, availabilityMap, defaultSettings } = get();
    if (!userId) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const slotColumn = slot.replace('-', '_');
    
    const { error } = await supabase
      .from('availability')
      .upsert({
        user_id: userId,
        date: dateStr,
        [slotColumn]: available,
      }, { onConflict: 'user_id,date' });
    
    if (error) {
      console.error('Error setting availability:', error);
      return;
    }
    
    const existing = availabilityMap[dateStr];
    
    if (existing) {
      const updatedEntry = {
        ...existing,
        slots: { ...existing.slots, [slot]: available },
      };
      const updated = availability.map(a => format(a.date, 'yyyy-MM-dd') === dateStr ? updatedEntry : a);
      set({ availability: updated, availabilityMap: { ...availabilityMap, [dateStr]: updatedEntry } });
    } else {
      const newAvailability = createDefaultAvailability(date, defaultSettings);
      newAvailability.slots[slot] = available;
      set({ 
        availability: [...availability, newAvailability],
        availabilityMap: { ...availabilityMap, [dateStr]: newAvailability },
      });
    }
  },
  
  setLocationStatus: async (status, date) => {
    const { userId, availability, availabilityMap, defaultSettings } = get();
    if (!userId) return;
    
    const targetDate = date || new Date();
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    const { error } = await supabase
      .from('availability')
      .upsert({
        user_id: userId,
        date: dateStr,
        location_status: status,
      }, { onConflict: 'user_id,date' });
    
    if (error) {
      console.error('Error setting location:', error);
      return;
    }
    
    const existing = availabilityMap[dateStr];
    
    if (existing) {
      const updatedEntry = { ...existing, locationStatus: status };
      const updated = availability.map(a => format(a.date, 'yyyy-MM-dd') === dateStr ? updatedEntry : a);
      set({ availability: updated, availabilityMap: { ...availabilityMap, [dateStr]: updatedEntry } });
    } else {
      const newAvailability = createDefaultAvailability(targetDate, defaultSettings);
      newAvailability.locationStatus = status;
      set({ 
        availability: [...availability, newAvailability],
        availabilityMap: { ...availabilityMap, [dateStr]: newAvailability },
      });
    }
    
    // If updating today, also update the global locationStatus for UI
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr === todayStr) {
      set({ locationStatus: status });
    }
  },
  
  getLocationStatusForDate: (date) => {
    const { availabilityMap } = get();
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availabilityMap[dateStr];
    return dayAvail?.locationStatus || 'home';
  },
  
  getVibeForDate: (date) => {
    const { availabilityMap } = get();
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availabilityMap[dateStr];
    return dayAvail?.vibe || null;
  },

  setVibeForDate: async (date, vibe) => {
    const { userId, availability, availabilityMap, defaultSettings } = get();
    if (!userId) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Optimistic update — update state immediately
    const existing = availabilityMap[dateStr];
    
    if (existing) {
      const updatedEntry = { ...existing, vibe };
      const updated = availability.map(a => format(a.date, 'yyyy-MM-dd') === dateStr ? updatedEntry : a);
      set({ availability: updated, availabilityMap: { ...availabilityMap, [dateStr]: updatedEntry } });
    } else {
      const newAvailability = createDefaultAvailability(date, defaultSettings);
      newAvailability.vibe = vibe;
      set({ 
        availability: [...availability, newAvailability],
        availabilityMap: { ...availabilityMap, [dateStr]: newAvailability },
      });
    }
    
    // If updating today, also update the global vibe
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr === todayStr && vibe) {
      set({ currentVibe: { type: vibe } });
    } else if (dateStr === todayStr && !vibe) {
      set({ currentVibe: null });
    }
    
    // Persist to database in the background
    const { error } = await supabase
      .from('availability')
      .upsert({
        user_id: userId,
        date: dateStr,
        vibe: vibe,
      } as any, { onConflict: 'user_id,date' });
    
    if (error) {
      console.error('Error setting vibe for date:', error);
    }
  },
  
  setVibe: async (vibe) => {
    const { userId } = get();
    if (!userId) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        current_vibe: vibe?.type || null,
        vibe_gif_url: vibe?.gifUrl || null,
      })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error setting vibe:', error);
      return;
    }
    
    set({ currentVibe: vibe });
  },
  
  addCustomVibe: async (tag) => {
    const { userId, currentVibe } = get();
    if (!userId) return;
    
    const existingTags = currentVibe?.customTags || [];
    if (existingTags.includes(tag)) return;
    
    const newTags = [...existingTags, tag];
    // Preserve the current vibe type (default to 'custom' if none set)
    const vibeType = currentVibe?.type || 'custom';
    const newVibe: Vibe = { type: vibeType, customTags: newTags, gifUrl: currentVibe?.gifUrl };
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        current_vibe: vibeType,
        custom_vibe_tags: newTags
      })
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error adding custom vibe:', error);
      return;
    }
    
    set({ currentVibe: newVibe });
  },
  
  removeCustomVibe: async (tag) => {
    const { userId, currentVibe } = get();
    if (!userId) return;
    
    const existingTags = currentVibe?.customTags || [];
    const newTags = existingTags.filter(t => t !== tag);
    const gifUrl = currentVibe?.gifUrl;
    const vibeType = currentVibe?.type || 'custom';
    
    if (newTags.length === 0) {
      // Clear custom tags but keep the vibe type if it's a standard one
      const keepVibe = vibeType !== 'custom' || !!gifUrl;
      const { error } = await supabase
        .from('profiles')
        .update({ 
          current_vibe: keepVibe ? vibeType : null,
          custom_vibe_tags: []
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      
      set({ currentVibe: keepVibe ? { type: vibeType, customTags: [], gifUrl } : null });
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_vibe_tags: newTags })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      
      set({ currentVibe: { type: vibeType, customTags: newTags, gifUrl } });
    }
  },
  
  loadAvailabilityForRange: async (startDate: Date, endDate: Date) => {
    const { userId, defaultSettings, availabilityMap: existingMap } = get();
    if (!userId) return;

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // Check if we already have data for the full range
    let allCovered = true;
    let checkDate = startDate;
    while (checkDate <= endDate) {
      if (!existingMap[format(checkDate, 'yyyy-MM-dd')]) { allCovered = false; break; }
      checkDate = addDays(checkDate, 1);
    }
    if (allCovered) return;

    const { data, error } = await supabase
      .from('availability')
      .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location, vibe')
      .eq('user_id', userId)
      .gte('date', startStr)
      .lte('date', endStr);

    if (error) {
      console.error('Error loading availability range:', error);
      return;
    }

    const fetchedMap = new Map<string, any>();
    for (const row of (data || [])) {
      fetchedMap.set(row.date, row);
    }

    const newMap = { ...existingMap };
    const newAvail = [...get().availability];
    let d = new Date(startDate);
    while (d <= endDate) {
      const dateStr = format(d, 'yyyy-MM-dd');
      if (!newMap[dateStr]) {
        const existing = fetchedMap.get(dateStr);
        const dayAvail: DayAvailability = existing ? {
          date: new Date(d),
          slots: {
            'early-morning':    existing.early_morning  ?? true,
            'late-morning':     existing.late_morning   ?? true,
            'early-afternoon':  existing.early_afternoon ?? true,
            'late-afternoon':   existing.late_afternoon  ?? true,
            'evening':          existing.evening        ?? true,
            'late-night':       existing.late_night     ?? true,
          },
          locationStatus: (existing.location_status as LocationStatus) || 'home',
          tripLocation:   existing.trip_location || undefined,
          vibe:           existing.vibe as VibeType | null || null,
        } : createDefaultAvailability(new Date(d), defaultSettings);
        newMap[dateStr] = dayAvail;
        newAvail.push(dayAvail);
      }
      d = addDays(d, 1);
    }

    set({ availability: newAvail, availabilityMap: newMap });
  },

  initializeWeekAvailability: async () => {
    const { userId, defaultSettings } = get();
    if (!userId) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const week: DayAvailability[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(createDefaultAvailability(addDays(start, i), defaultSettings));
      }
      set({ availability: week, availabilityMap: buildAvailabilityMap(week) });
      return;
    }
    
     await get().loadProfileAndAvailability();
  },

  loadFriends: async () => {
    const { userId } = get();
    if (!userId) return;

    const [outgoingResult, incomingResult] = await Promise.all([
      supabase.from('friendships').select('*').eq('user_id', userId),
      supabase.from('friendships_incoming' as any).select('*').eq('friend_user_id', userId),
    ]);

    const outgoingData = outgoingResult.data;
    const incomingData = incomingResult.data;

    const incomingUserIds = (incomingData || []).map((f: any) => f.user_id).filter(Boolean);
    const outgoingUserIds = (outgoingData || []).map((f: any) => f.friend_user_id).filter(Boolean) as string[];

    const [incomingProfilesResult, outgoingProfilesResult] = await Promise.all([
      incomingUserIds.length > 0
        ? supabase.rpc('get_display_names_for_users', { p_user_ids: incomingUserIds })
        : Promise.resolve({ data: [] as any[] }),
      outgoingUserIds.length > 0
        ? supabase.from('public_profiles').select('user_id, avatar_url').in('user_id', outgoingUserIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const incomingProfilesMap = new Map((incomingProfilesResult.data || []).map((p: any) => [p.user_id, p]));
    const outgoingAvatarMap = new Map<string, string | null>((outgoingProfilesResult.data || []).map((p: any) => [p.user_id, p.avatar_url]));

    const outgoingFriends: Friend[] = (outgoingData || []).map((f) => ({
      id: f.id,
      name: f.friend_name,
      email: f.friend_email || undefined,
      avatar: f.friend_user_id ? (outgoingAvatarMap.get(f.friend_user_id) || undefined) : undefined,
      friendUserId: f.friend_user_id || undefined,
      status: f.status as 'connected' | 'pending' | 'invited',
      isIncoming: false,
      isPodMember: (f as any).is_pod_member || false,
    }));

    const incomingFriends: Friend[] = (incomingData || []).map((f: any) => {
      const prof = incomingProfilesMap.get(f.user_id);
      return {
        id: f.id,
        name: (prof as any)?.display_name || 'Someone',
        avatar: (prof as any)?.avatar_url || undefined,
        friendUserId: f.user_id,
        status: f.status as 'connected' | 'pending' | 'invited',
        isIncoming: true,
      };
    });

    // Deduplicate
    const statusPriority: Record<string, number> = { connected: 3, pending: 2, invited: 1 };
    const globalByUserId = new Map<string, Friend>();
    const noUserId: Friend[] = [];
    for (const f of [...outgoingFriends, ...incomingFriends]) {
      if (!f.friendUserId) { noUserId.push(f); continue; }
      const existing = globalByUserId.get(f.friendUserId);
      if (!existing || (statusPriority[f.status] || 0) > (statusPriority[existing.status] || 0)) {
        if (existing && !f.isIncoming && existing.isIncoming) {
          globalByUserId.set(f.friendUserId, { ...f });
        } else if (existing && f.isIncoming && !existing.isIncoming) {
          globalByUserId.set(f.friendUserId, { ...existing, status: f.status });
        } else {
          globalByUserId.set(f.friendUserId, f);
        }
      }
    }
    set({ friends: [...globalByUserId.values(), ...noUserId] });
  },

  loadPlans: async () => {
    const { userId, userTimezone } = get();
    if (!userId) return;

    const [ownPlansResult, participatedPlanIdsResult] = await Promise.all([
      supabase.from('plans').select('*').eq('user_id', userId).order('date', { ascending: true }).limit(200),
      supabase.rpc('user_participated_plan_ids', { p_user_id: userId }),
    ]);

    const ownPlansData = ownPlansResult.data;
    const participatedPlanIds = participatedPlanIdsResult.data;

    const participatedPlansData = (participatedPlanIds && participatedPlanIds.length > 0)
      ? (await supabase.from('plans').select('*').in('id', participatedPlanIds).order('date', { ascending: true }).limit(200)).data || []
      : [];

    const ownIds = new Set((ownPlansData || []).map(p => p.id));
    const ownHangKeys = new Set(
      (ownPlansData || []).filter(p => p.source === 'hang-request').map(p => `${p.date}|${p.time_slot}`)
    );
    const plansData = [
      ...(ownPlansData || []),
      ...participatedPlansData.filter(p => {
        if (ownIds.has(p.id)) return false;
        if (p.source === 'hang-request' && ownHangKeys.has(`${p.date}|${p.time_slot}`)) return false;
        return true;
      }),
    ];

    const planIds = plansData.map(p => p.id);
    let participantsMap: Record<string, { friend_id: string; status: string; role: string; responded_at: string | null }[]> = {};
    if (planIds.length > 0) {
      const { data: participantsData } = await supabase.from('plan_participants').select('plan_id, friend_id, status, role, responded_at').in('plan_id', planIds);
      for (const pp of (participantsData || [])) {
        if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
        participantsMap[pp.plan_id].push({ friend_id: pp.friend_id, status: pp.status, role: pp.role, responded_at: pp.responded_at });
      }
    }

    const participantUserIds = new Set<string>();
    for (const pps of Object.values(participantsMap)) {
      for (const pp of pps) participantUserIds.add(pp.friend_id);
    }
    for (const p of plansData) {
      if (p.user_id !== userId) participantUserIds.add(p.user_id);
    }

    let profilesMap: Record<string, string> = {};
    let profileAvatarsMap: Record<string, string | null> = {};
    if (participantUserIds.size > 0) {
      const { data: profiles } = await supabase.from('public_profiles').select('user_id, display_name, avatar_url').in('user_id', Array.from(participantUserIds));
      for (const p of (profiles || [])) {
        if (p.user_id) {
          profilesMap[p.user_id] = p.display_name || 'Friend';
          profileAvatarsMap[p.user_id] = p.avatar_url;
        }
      }
    }

    const viewerTimezone = userTimezone;
    const plans: Plan[] = plansData.map((p) => {
      const allPps = participantsMap[p.id] || [];
      const myParticipation = allPps.find(pp => pp.friend_id === userId);
      const myRole = p.user_id === userId ? 'participant' : (myParticipation?.role as 'participant' | 'subscriber') || 'participant';
      const rawPps = allPps.filter(pp => pp.friend_id !== userId);
      const pps = [...rawPps];
      if (p.user_id !== userId && !pps.some(pp => pp.friend_id === p.user_id)) {
        pps.push({ friend_id: p.user_id, status: 'accepted', role: 'participant', responded_at: null });
      }
      const planDateRaw = new Date(p.date);
      const planYear = planDateRaw.getUTCFullYear();
      const planMonth = planDateRaw.getUTCMonth();
      const planDay = planDateRaw.getUTCDate();
      let normalizedPlanDate = new Date(planYear, planMonth, planDay);

      let effectiveTimeSlot = p.time_slot as TimeSlot;
      let effectiveStartTime: string | undefined = (p as any).start_time || undefined;
      let effectiveEndTime: string | undefined = (p as any).end_time || undefined;

      const sourceTimezone = (p as any).source_timezone;
      if (sourceTimezone && sourceTimezone !== viewerTimezone && p.user_id !== userId) {
        if (effectiveStartTime) {
          const converted = convertTimeBetweenTimezones(effectiveStartTime, normalizedPlanDate, sourceTimezone, viewerTimezone);
          effectiveStartTime = converted.time;
          if (converted.dayOffset !== 0) normalizedPlanDate = addDays(normalizedPlanDate, converted.dayOffset);
          effectiveTimeSlot = getTimeSlotForTime(converted.time) as TimeSlot;
        } else {
          const midpoint = getTimeSlotMidpoint(p.time_slot);
          const converted = convertTimeBetweenTimezones(midpoint, normalizedPlanDate, sourceTimezone, viewerTimezone);
          effectiveTimeSlot = getTimeSlotForTime(converted.time) as TimeSlot;
          if (converted.dayOffset !== 0) normalizedPlanDate = addDays(normalizedPlanDate, converted.dayOffset);
        }
        if (effectiveEndTime) {
          const convertedEnd = convertTimeBetweenTimezones(effectiveEndTime, new Date(planYear, planMonth, planDay), sourceTimezone, viewerTimezone);
          effectiveEndTime = convertedEnd.time;
        }
      }

      return {
        id: p.id,
        userId: p.user_id,
        title: p.title,
        activity: p.activity as ActivityType,
        date: normalizedPlanDate,
        endDate: (p as any).end_date ? (() => { const ed = new Date((p as any).end_date); return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate()); })() : undefined,
        timeSlot: effectiveTimeSlot,
        duration: p.duration,
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
        notes: p.notes || undefined,
        status: (p as any).status as PlanStatus || 'confirmed',
        feedVisibility: (p as any).feed_visibility || 'private',
        participants: pps.map(pp => ({
          id: pp.friend_id,
          name: profilesMap[pp.friend_id] || 'Friend',
          avatar: profileAvatarsMap[pp.friend_id] || undefined,
          friendUserId: pp.friend_id,
          status: 'connected' as const,
          role: (pp.role as 'participant' | 'subscriber') || 'participant',
          rsvpStatus: pp.status as string || 'invited',
          respondedAt: pp.responded_at ? new Date(pp.responded_at) : undefined,
        })),
        myRole,
        myRsvpStatus: p.user_id === userId ? undefined : (myParticipation?.status as string || 'invited'),
        recurringPlanId: (p as any).recurring_plan_id || undefined,
        createdAt: new Date(p.created_at),
      };
    });

    set({ plans });
  },

  loadProfileAndAvailability: async () => {
    const { userId } = get();
    if (!userId) return;

    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const availStartDate = format(addDays(start, -183), 'yyyy-MM-dd');
    const availEndDate = format(addDays(start, 183), 'yyyy-MM-dd');

    const [availResult, profileResult] = await Promise.all([
      supabase.from('availability').select('*').eq('user_id', userId).gte('date', availStartDate).lte('date', availEndDate),
      supabase.from('profiles')
        .select('current_vibe, location_status, custom_vibe_tags, vibe_gif_url, default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status, default_vibes, home_address, timezone')
        .eq('user_id', userId).single(),
    ]);

    const availData = availResult.data;
    const profile = profileResult.data;

    const defaultSettings: DefaultAvailabilitySettings = {
      workDays: (profile as any)?.default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      workStartHour: (profile as any)?.default_work_start_hour ?? 9,
      workEndHour: (profile as any)?.default_work_end_hour ?? 17,
      defaultStatus: (profile as any)?.default_availability_status || 'free',
      defaultVibes: (profile as any)?.default_vibes || [],
    };

    const availDataMap = new Map<string, any>();
    if (availData) { for (const a of availData) availDataMap.set(a.date, a); }

    const allDates = Array.from({ length: 366 }, (_, i) => format(addDays(start, i - 183), 'yyyy-MM-dd'));
    const availabilityWithDefaults: DayAvailability[] = allDates.map((dateStr, i) => {
      const existing = availDataMap.get(dateStr);
      const date = addDays(start, i - 183);
      if (existing) {
        return {
          date,
          slots: {
            'early-morning': existing.early_morning ?? true,
            'late-morning': existing.late_morning ?? true,
            'early-afternoon': existing.early_afternoon ?? true,
            'late-afternoon': existing.late_afternoon ?? true,
            'evening': existing.evening ?? true,
            'late-night': existing.late_night ?? true,
          },
          locationStatus: (existing.location_status as LocationStatus) || 'home',
          tripLocation: existing.trip_location || undefined,
          vibe: (existing as any).vibe as VibeType | null || null,
        };
      }
      return createDefaultAvailability(date, defaultSettings);
    });

    const availabilityMap = buildAvailabilityMap(availabilityWithDefaults);
    const homeAddr = (profile as any)?.home_address || null;
    const customTags = (profile as any)?.custom_vibe_tags || [];
    const vibeGifUrl = (profile as any)?.vibe_gif_url || undefined;
    const currentVibe = (profile as any)?.current_vibe
      ? { type: (profile as any).current_vibe as VibeType, customTags: (profile as any).current_vibe === 'custom' ? customTags : undefined, gifUrl: vibeGifUrl }
      : null;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayAvail = availabilityMap[todayStr];
    const todayLocationStatus = todayAvail?.locationStatus || 'home';

    set({
      availability: availabilityWithDefaults,
      availabilityMap,
      currentVibe,
      locationStatus: todayLocationStatus,
      defaultSettings,
      homeAddress: homeAddr,
    });
  },
}));
