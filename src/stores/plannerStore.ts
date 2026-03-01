import { create } from 'zustand';
import { Plan, Friend, DayAvailability, Vibe, TimeSlot, LocationStatus, ActivityType, VibeType, PlanStatus } from '@/types/planner';
import { addDays, startOfWeek, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getUserTimezone } from '@/lib/timezone';

interface DefaultAvailabilitySettings {
  workDays: string[];
  workStartHour: number;
  workEndHour: number;
  defaultStatus: 'free' | 'unavailable';
  defaultVibes: string[];
}

interface PlannerState {
  plans: Plan[];
  friends: Friend[];
  availability: DayAvailability[];
  currentVibe: Vibe | null;
  locationStatus: LocationStatus;
  isLoading: boolean;
  userId: string | null;
  defaultSettings: DefaultAvailabilitySettings | null;
  homeAddress: string | null;
  userTimezone: string;
  
  setUserId: (userId: string | null) => void;
  loadAllData: () => Promise<void>;
  
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt'>) => Promise<void>;
  updatePlan: (id: string, updates: Partial<Plan>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
  
  addFriend: (friend: Omit<Friend, 'id'>) => Promise<void>;
  updateFriend: (id: string, updates: Partial<Friend>) => Promise<void>;
  acceptFriendRequest: (friendshipId: string, requesterUserId: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  
  setAvailability: (date: Date, slot: TimeSlot, available: boolean) => Promise<void>;
  setLocationStatus: (status: LocationStatus, date?: Date) => Promise<void>;
  getLocationStatusForDate: (date: Date) => LocationStatus;
  setVibe: (vibe: Vibe | null) => Promise<void>;
  addCustomVibe: (tag: string) => Promise<void>;
  removeCustomVibe: (tag: string) => Promise<void>;
  
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
  currentVibe: null,
  locationStatus: 'home',
  isLoading: true,
  userId: null,
  defaultSettings: null,
  homeAddress: null,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  
  setUserId: (userId) => set({ userId }),
  
  loadAllData: async () => {
    const { userId } = get();
    if (!userId) {
      set({ isLoading: false });
      return;
    }
    
    set({ isLoading: true });
    
    try {
      // Prepare date range for availability (6 months to match calendar sync window)
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const availStartDate = format(addDays(start, -90), 'yyyy-MM-dd');
      const availEndDate = format(addDays(start, 180), 'yyyy-MM-dd');

      // Fire ALL independent queries in parallel
      const [
        ownPlansResult,
        participatedPlanIdsResult,
        outgoingResult,
        incomingResult,
        availResult,
        profileResult,
      ] = await Promise.all([
        // 1. Own plans
        supabase
          .from('plans')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .limit(200),
        // 2. Participated plan IDs
        supabase.rpc('user_participated_plan_ids', { p_user_id: userId }),
        // 3. Outgoing friendships
        supabase
          .from('friendships')
          .select('*')
          .eq('user_id', userId),
        // 4. Incoming friendships
        supabase
          .from('friendships_incoming' as any)
          .select('*')
          .eq('friend_user_id', userId),
        // 5. Availability
        supabase
          .from('availability')
          .select('*')
          .eq('user_id', userId)
          .gte('date', availStartDate)
          .lte('date', availEndDate),
        // 6. Profile
        supabase
          .from('profiles')
          .select('current_vibe, location_status, custom_vibe_tags, default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status, default_vibes, home_address')
          .eq('user_id', userId)
          .single(),
      ]);

      const ownPlansData = ownPlansResult.data;
      const participatedPlanIds = participatedPlanIdsResult.data;
      const outgoingData = outgoingResult.data;
      const incomingData = incomingResult.data;
      const availData = availResult.data;
      const profile = profileResult.data;

      // Second wave: fetch participated plans + incoming friend profiles in parallel
      const participatedPlansPromise = (participatedPlanIds && participatedPlanIds.length > 0)
        ? supabase
            .from('plans')
            .select('*')
            .in('id', participatedPlanIds)
            .order('date', { ascending: true })
            .limit(200)
        : Promise.resolve({ data: [] as typeof ownPlansData });

      // Batch fetch incoming friend profiles using RPC (works even for non-discoverable users)
      const incomingUserIds = (incomingData || []).map((f: any) => f.user_id).filter(Boolean);
      const incomingProfilesPromise = incomingUserIds.length > 0
        ? supabase.rpc('get_display_names_for_users', { p_user_ids: incomingUserIds })
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] });

      // Batch fetch outgoing friend avatars
      const outgoingUserIds = (outgoingData || []).map((f: any) => f.friend_user_id).filter(Boolean) as string[];
      const outgoingProfilesPromise = outgoingUserIds.length > 0
        ? supabase
            .from('public_profiles')
            .select('user_id, avatar_url')
            .in('user_id', outgoingUserIds)
        : Promise.resolve({ data: [] as { user_id: string; avatar_url: string | null }[] });

      const [participatedPlansResult, incomingProfilesResult, outgoingProfilesResult] = await Promise.all([
        participatedPlansPromise,
        incomingProfilesPromise,
        outgoingProfilesPromise,
      ]);

      const participatedPlansData = participatedPlansResult.data || [];

      // Build incoming profiles map
      const incomingProfilesMap = new Map(
        (incomingProfilesResult.data || []).map((p: any) => [p.user_id, p])
      );

      // Build outgoing avatar map
      const outgoingAvatarMap = new Map<string, string | null>(
        (outgoingProfilesResult.data || []).map((p: any) => [p.user_id, p.avatar_url])
      );
      
      // Merge and dedupe plans
      const ownIds = new Set((ownPlansData || []).map(p => p.id));
      const ownHangKeys = new Set(
        (ownPlansData || [])
          .filter(p => p.source === 'hang-request')
          .map(p => `${p.date}|${p.time_slot}`)
      );
      const plansData = [
        ...(ownPlansData || []),
        ...(participatedPlansData || []).filter(p => {
          if (ownIds.has(p.id)) return false;
          if (p.source === 'hang-request' && ownHangKeys.has(`${p.date}|${p.time_slot}`)) return false;
          return true;
        }),
      ];
      
      // Load plan participants (third wave - depends on merged plan list)
      const planIds = (plansData || []).map(p => p.id);
      let participantsMap: Record<string, { friend_id: string; status: string; role: string }[]> = {};
      
      if (planIds.length > 0) {
        const { data: participantsData } = await supabase
          .from('plan_participants')
          .select('plan_id, friend_id, status, role')
          .in('plan_id', planIds);
        
        for (const pp of (participantsData || [])) {
          if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
          participantsMap[pp.plan_id].push({ friend_id: pp.friend_id, status: pp.status, role: pp.role });
        }
      }
      
      // Collect unique user IDs for profile resolution
      const participantUserIds = new Set<string>();
      for (const pps of Object.values(participantsMap)) {
        for (const pp of pps) participantUserIds.add(pp.friend_id);
      }
      for (const p of (plansData || [])) {
        if (p.user_id !== userId) participantUserIds.add(p.user_id);
      }
      
      let profilesMap: Record<string, string> = {};
      if (participantUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name')
          .in('user_id', Array.from(participantUserIds));
        
        for (const p of (profiles || [])) {
          if (p.user_id) profilesMap[p.user_id] = p.display_name || 'Friend';
        }
      }
      
      const plans: Plan[] = (plansData || []).map((p) => {
        const allPps = participantsMap[p.id] || [];
        const myParticipation = allPps.find(pp => pp.friend_id === userId);
        const myRole = p.user_id === userId ? 'participant' : (myParticipation?.role as 'participant' | 'subscriber') || 'participant';
        const rawPps = allPps.filter(pp => pp.friend_id !== userId);
        const pps = [...rawPps];
        if (p.user_id !== userId && !pps.some(pp => pp.friend_id === p.user_id)) {
          pps.push({ friend_id: p.user_id, status: 'accepted', role: 'participant' });
        }
        const planDateRaw = new Date(p.date);
        const planYear = planDateRaw.getUTCFullYear();
        const planMonth = planDateRaw.getUTCMonth();
        const planDay = planDateRaw.getUTCDate();
        const normalizedPlanDate = new Date(planYear, planMonth, planDay);
        return {
          id: p.id,
          userId: p.user_id,
          title: p.title,
          activity: p.activity as ActivityType,
          date: normalizedPlanDate,
          endDate: (p as any).end_date ? (() => {
            const ed = new Date((p as any).end_date);
            return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate());
          })() : undefined,
          timeSlot: p.time_slot as TimeSlot,
          duration: p.duration,
          startTime: (p as any).start_time || undefined,
          endTime: (p as any).end_time || undefined,
          location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
          notes: p.notes || undefined,
          status: (p as any).status as PlanStatus || 'confirmed',
          participants: pps.map(pp => ({
            id: pp.friend_id,
            name: profilesMap[pp.friend_id] || 'Friend',
            friendUserId: pp.friend_id,
            status: 'connected' as const,
            role: (pp.role as 'participant' | 'subscriber') || 'participant',
          })),
          myRole,
          createdAt: new Date(p.created_at),
        };
      });
      
      // Process friendships
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
      
      // Use batched profiles instead of N+1
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
      
      // Deduplicate outgoing friends
      const dedupeOutgoing = (list: Friend[]): Friend[] => {
        const byUserId = new Map<string, Friend>();
        const noUserId: Friend[] = [];
        const statusPriority: Record<string, number> = { connected: 3, pending: 2, invited: 1 };
        
        for (const f of list) {
          if (!f.friendUserId) {
            noUserId.push(f);
            continue;
          }
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
      
      const allFriends = [...dedupedOutgoing];
      for (const incoming of incomingFriends) {
        const existingOutgoing = dedupedOutgoing.find(
          (o) => o.friendUserId === incoming.friendUserId
        );
        if (!existingOutgoing) {
          allFriends.push(incoming);
        }
      }
      
      const friends = allFriends;
      
      // Process availability with default settings from profile
      const customTags = (profile as any)?.custom_vibe_tags || [];
      const currentVibe = (profile as any)?.current_vibe 
        ? { 
            type: (profile as any).current_vibe as VibeType,
            customTags: (profile as any).current_vibe === 'custom' ? customTags : undefined
          } 
        : null;
      
      const defaultSettings: DefaultAvailabilitySettings = {
        workDays: (profile as any)?.default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        workStartHour: (profile as any)?.default_work_start_hour ?? 9,
        workEndHour: (profile as any)?.default_work_end_hour ?? 17,
        defaultStatus: (profile as any)?.default_availability_status || 'free',
        defaultVibes: (profile as any)?.default_vibes || [],
      };
      
      // Generate dates array covering the full availability window (270 days: -90 to +180)
      const allDates = Array.from({ length: 270 }, (_, i) => format(addDays(start, i - 90), 'yyyy-MM-dd'));
      const availabilityWithDefaults: DayAvailability[] = allDates.map((dateStr, i) => {
        const existing = (availData || []).find((a) => a.date === dateStr);
        const date = addDays(start, i - 90);
        
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
          };
        }
        return createDefaultAvailability(date, defaultSettings);
      });
      
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayAvail = availabilityWithDefaults.find(a => format(a.date, 'yyyy-MM-dd') === todayStr);
      const todayLocationStatus = todayAvail?.locationStatus || 'home';
      
      const homeAddr = (profile as any)?.home_address || null;
      const todayTrip = todayAvail?.tripLocation || undefined;
      const derivedTimezone = getUserTimezone(todayLocationStatus, homeAddr, todayTrip);
      
      set({
        plans,
        friends,
        availability: availabilityWithDefaults,
        currentVibe,
        locationStatus: todayLocationStatus,
        defaultSettings,
        homeAddress: homeAddr,
        userTimezone: derivedTimezone,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      set({ isLoading: false });
    }
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
        status: plan.status || 'confirmed',
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

        // Send push notifications to invited participants
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', userId).single();
          const senderName = profile?.display_name || 'Someone';

          for (const row of participantRows) {
            fetch(`https://${projectId}.supabase.co/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: row.friend_id,
                title: 'New Plan Invite! 📅',
                body: `${senderName} invited you to "${plan.title}"`,
                url: `/plan/${data.id}`,
              }),
            }).catch(() => {});
          }
        } catch (err) {
          console.error('Push notification error:', err);
        }
      }
    }
    
    set((state) => ({ plans: [...state.plans, newPlan] }));
    
    // Auto-block the availability slot for this plan (only for confirmed plans)
    if ((plan.status || 'confirmed') === 'confirmed') {
      const slotColumn = plan.timeSlot.replace('-', '_');
      await supabase
        .from('availability')
        .upsert({
          user_id: userId,
          date: dateStr,
          [slotColumn]: false,
        }, { onConflict: 'user_id,date' });
      
      // Update local availability state
      const { availability, defaultSettings } = get();
      const existingIndex = availability.findIndex(
        (a) => format(a.date, 'yyyy-MM-dd') === dateStr
      );
      if (existingIndex >= 0) {
        const updated = [...availability];
        updated[existingIndex] = {
          ...updated[existingIndex],
          slots: { ...updated[existingIndex].slots, [plan.timeSlot]: false },
        };
        set({ availability: updated });
      } else {
        const newAvailability = createDefaultAvailability(plan.date, defaultSettings);
        newAvailability.slots[plan.timeSlot] = false;
        set({ availability: [...availability, newAvailability] });
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
      // Delete existing participants and re-insert
      await supabase.from('plan_participants').delete().eq('plan_id', id);
      
      const participantRows = updates.participants
        .filter(p => p.friendUserId)
        .map(p => ({
          plan_id: id,
          friend_id: p.friendUserId!,
          status: 'invited',
          role: p.role || 'participant',
        }));
      
      if (participantRows.length > 0) {
        await supabase.from('plan_participants').insert(participantRows);
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
        .update({ status: 'declined' })
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
        
        const existingIndex = availability.findIndex(
          (a) => format(a.date, 'yyyy-MM-dd') === dateStr
        );
        if (existingIndex >= 0) {
          const updated = [...get().availability];
          updated[existingIndex] = {
            ...updated[existingIndex],
            slots: { ...updated[existingIndex].slots, [planToDelete.timeSlot]: true },
          };
          set({ availability: updated });
        }
      }
    }
  },
  
  addFriend: async (friend) => {
    const { userId } = get();
    if (!userId) return;
    
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
    const { userId, availability, defaultSettings } = get();
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
    
    const existingIndex = availability.findIndex(
      (a) => format(a.date, 'yyyy-MM-dd') === dateStr
    );
    
    if (existingIndex >= 0) {
      const updated = [...availability];
      updated[existingIndex] = {
        ...updated[existingIndex],
        slots: { ...updated[existingIndex].slots, [slot]: available },
      };
      set({ availability: updated });
    } else {
      const newAvailability = createDefaultAvailability(date, defaultSettings);
      newAvailability.slots[slot] = available;
      set({ availability: [...availability, newAvailability] });
    }
  },
  
  setLocationStatus: async (status, date) => {
    const { userId, availability, defaultSettings } = get();
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
    
    // Update availability array
    const existingIndex = availability.findIndex(
      (a) => format(a.date, 'yyyy-MM-dd') === dateStr
    );
    
    if (existingIndex >= 0) {
      const updated = [...availability];
      updated[existingIndex] = {
        ...updated[existingIndex],
        locationStatus: status,
      };
      set({ availability: updated });
    } else {
      const newAvailability = createDefaultAvailability(targetDate, defaultSettings);
      newAvailability.locationStatus = status;
      set({ availability: [...availability, newAvailability] });
    }
    
    // If updating today, also update the global locationStatus for UI
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (dateStr === todayStr) {
      set({ locationStatus: status });
    }
  },
  
  getLocationStatusForDate: (date) => {
    const { availability } = get();
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availability.find(a => format(a.date, 'yyyy-MM-dd') === dateStr);
    return dayAvail?.locationStatus || 'home';
  },
  
  setVibe: async (vibe) => {
    const { userId } = get();
    if (!userId) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ current_vibe: vibe?.type || null })
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
    const newVibe: Vibe = { type: 'custom', customTags: newTags };
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        current_vibe: 'custom',
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
    
    if (newTags.length === 0) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          current_vibe: null,
          custom_vibe_tags: []
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      
      set({ currentVibe: null });
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_vibe_tags: newTags })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      
      const newVibe: Vibe = { type: 'custom', customTags: newTags };
      set({ currentVibe: newVibe });
    }
  },
  
  initializeWeekAvailability: async () => {
    const { userId, defaultSettings } = get();
    if (!userId) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const week: DayAvailability[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(createDefaultAvailability(addDays(start, i), defaultSettings));
      }
      set({ availability: week });
      return;
    }
    
    await get().loadAllData();
  },
}));
