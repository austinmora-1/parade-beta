import { create } from 'zustand';
import { Plan, Friend, DayAvailability, Vibe, TimeSlot, LocationStatus, ActivityType, VibeType } from '@/types/planner';
import { addDays, startOfWeek, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
  
  setUserId: (userId) => set({ userId }),
  
  loadAllData: async () => {
    const { userId } = get();
    if (!userId) {
      set({ isLoading: false });
      return;
    }
    
    set({ isLoading: true });
    
    try {
      // Load own plans
      const { data: ownPlansData } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });
      
      // Load plans where user is a participant (invited by others)
      const { data: participatedPlanIds } = await supabase
        .rpc('user_participated_plan_ids', { p_user_id: userId });
      
      let participatedPlansData: typeof ownPlansData = [];
      if (participatedPlanIds && participatedPlanIds.length > 0) {
        const { data } = await supabase
          .from('plans')
          .select('*')
          .in('id', participatedPlanIds)
          .order('date', { ascending: true });
        participatedPlansData = data || [];
      }
      
      // Merge and dedupe plans
      const ownIds = new Set((ownPlansData || []).map(p => p.id));
      const plansData = [
        ...(ownPlansData || []),
        ...(participatedPlansData || []).filter(p => !ownIds.has(p.id)),
      ];
      
      // Load plan participants
      const planIds = (plansData || []).map(p => p.id);
      let participantsMap: Record<string, { friend_id: string; status: string }[]> = {};
      
      if (planIds.length > 0) {
        const { data: participantsData } = await supabase
          .from('plan_participants')
          .select('plan_id, friend_id, status')
          .in('plan_id', planIds);
        
        for (const pp of (participantsData || [])) {
          if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
          participantsMap[pp.plan_id].push({ friend_id: pp.friend_id, status: pp.status });
        }
      }
      
      // Collect unique friend_ids and plan owner ids to resolve names
      const participantUserIds = new Set<string>();
      for (const pps of Object.values(participantsMap)) {
        for (const pp of pps) participantUserIds.add(pp.friend_id);
      }
      // Add owners of participated plans so we can show their names
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
        // Filter out the current user from participants
        const rawPps = (participantsMap[p.id] || []).filter(pp => pp.friend_id !== userId);
        // For participated plans (not owned), include the plan owner as a participant
        const pps = [...rawPps];
        if (p.user_id !== userId && !pps.some(pp => pp.friend_id === p.user_id)) {
          pps.push({ friend_id: p.user_id, status: 'accepted' });
        }
        // Normalize plan date to local calendar day to prevent timezone day-shift.
        // Plans stored at midnight UTC (e.g. 2026-02-27T00:00:00+00) appear as
        // the previous day in western timezones. Extract the UTC date parts and
        // construct a local-midnight Date so isSameDay() matches correctly.
        const planDateRaw = new Date(p.date);
        const planYear = planDateRaw.getUTCFullYear();
        const planMonth = planDateRaw.getUTCMonth();
        const planDay = planDateRaw.getUTCDate();
        // If stored near midnight UTC (hour 0-3), the intended calendar day is
        // the UTC date. For noon UTC or other times, UTC date is also correct.
        const normalizedPlanDate = new Date(planYear, planMonth, planDay);
        return {
          id: p.id,
          title: p.title,
          activity: p.activity as ActivityType,
          date: normalizedPlanDate,
          timeSlot: p.time_slot as TimeSlot,
          duration: p.duration,
          location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
          notes: p.notes || undefined,
          participants: pps.map(pp => ({
            id: pp.friend_id,
            name: profilesMap[pp.friend_id] || 'Friend',
            friendUserId: pp.friend_id,
            status: 'connected' as const,
          })),
          createdAt: new Date(p.created_at),
        };
      });
      
      // Load outgoing friendships (requests I sent)
      const { data: outgoingData } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', userId);
      
      // Load incoming friendships (requests sent to me) - uses view that excludes friend_email
      const { data: incomingData } = await supabase
        .from('friendships_incoming' as any)
        .select('*')
        .eq('friend_user_id', userId);
      
      const outgoingFriends: Friend[] = (outgoingData || []).map((f) => ({
        id: f.id,
        name: f.friend_name,
        email: f.friend_email || undefined,
        friendUserId: f.friend_user_id || undefined,
        status: f.status as 'connected' | 'pending' | 'invited',
        isIncoming: false,
      }));
      
      // For incoming requests, we need to get the requester's profile info
      const incomingFriends: Friend[] = await Promise.all(
        (incomingData || []).map(async (f: any) => {
          // Get the requester's profile
          const { data: profile } = await supabase
            .from('public_profiles')
            .select('display_name, avatar_url')
            .eq('user_id', f.user_id)
            .single();
          
          return {
            id: f.id,
            name: profile?.display_name || f.friend_name || 'User',
            avatar: profile?.avatar_url || undefined,
            friendUserId: f.user_id, // The person who sent the request
            status: f.status as 'connected' | 'pending' | 'invited',
            isIncoming: true,
          };
        })
      );
      
      // Combine and dedupe (connected friends might appear in both)
      const allFriends = [...outgoingFriends];
      for (const incoming of incomingFriends) {
        // Only add if not already connected via outgoing
        const existingOutgoing = outgoingFriends.find(
          (o) => o.friendUserId === incoming.friendUserId && o.status === 'connected'
        );
        if (!existingOutgoing) {
          allFriends.push(incoming);
        }
      }
      
      const friends = allFriends;
      
      // Load availability for the next 5 weeks (35 days) so navigating weeks works
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const dates = Array.from({ length: 35 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
      
      const { data: availData } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', userId)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1]);
      
      const availability: DayAvailability[] = dates.map((dateStr, i) => {
        const existing = (availData || []).find((a) => a.date === dateStr);
        const date = addDays(start, i);
        
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
        return createDefaultAvailability(date);
      });
      
      // Get today's location status from availability
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayAvail = availability.find(a => format(a.date, 'yyyy-MM-dd') === todayStr);
      const todayLocationStatus = todayAvail?.locationStatus || 'home';
      
      // Load vibe, location, and default availability settings from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_vibe, location_status, custom_vibe_tags, default_work_days, default_work_start_hour, default_work_end_hour, default_availability_status, default_vibes, home_address')
        .eq('user_id', userId)
        .single();
      
      const customTags = (profile as any)?.custom_vibe_tags || [];
      const currentVibe = (profile as any)?.current_vibe 
        ? { 
            type: (profile as any).current_vibe as VibeType,
            customTags: (profile as any).current_vibe === 'custom' ? customTags : undefined
          } 
        : null;
      
      // Build default settings from profile
      const defaultSettings: DefaultAvailabilitySettings = {
        workDays: (profile as any)?.default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        workStartHour: (profile as any)?.default_work_start_hour ?? 9,
        workEndHour: (profile as any)?.default_work_end_hour ?? 17,
        defaultStatus: (profile as any)?.default_availability_status || 'free',
        defaultVibes: (profile as any)?.default_vibes || [],
      };
      
      // Re-process availability with default settings for days without saved data
      const availabilityWithDefaults: DayAvailability[] = dates.map((dateStr, i) => {
        const existing = (availData || []).find((a) => a.date === dateStr);
        const date = addDays(start, i);
        
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
      
      set({
        plans,
        friends,
        availability: availabilityWithDefaults,
        currentVibe,
        locationStatus: todayLocationStatus,
        defaultSettings,
        homeAddress: (profile as any)?.home_address || null,
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
    
    const { data, error } = await supabase
      .from('plans')
      .insert({
        user_id: userId,
        title: plan.title,
        activity: plan.activity,
        date: noonUtcDate,
        time_slot: plan.timeSlot,
        duration: plan.duration,
        location: locationStr,
        notes: plan.notes,
      })
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
      timeSlot: data.time_slot as TimeSlot,
      duration: data.duration,
      location: data.location ? { id: data.id, name: data.location, address: '' } : undefined,
      notes: data.notes || undefined,
      participants: plan.participants || [],
      createdAt: new Date(data.created_at),
    };
    
    set((state) => ({ plans: [...state.plans, newPlan] }));
    
    // Auto-block the availability slot for this plan
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
  },
  
  updatePlan: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.activity) dbUpdates.activity = updates.activity;
    if (updates.date) {
      const dateStr = format(updates.date, 'yyyy-MM-dd');
      dbUpdates.date = `${dateStr}T12:00:00+00:00`;
    }
    if (updates.timeSlot) dbUpdates.time_slot = updates.timeSlot;
    if (updates.duration) dbUpdates.duration = updates.duration;
    if (updates.location !== undefined) dbUpdates.location = updates.location?.name || null;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    
    const { error } = await supabase
      .from('plans')
      .update(dbUpdates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating plan:', error);
      return;
    }
    
    set((state) => ({
      plans: state.plans.map((p) => p.id === id ? { ...p, ...updates } : p),
    }));
  },
  
  deletePlan: async (id) => {
    const { userId, plans: currentPlans, availability, defaultSettings } = get();
    const planToDelete = currentPlans.find(p => p.id === id);
    
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting plan:', error);
      return;
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
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name) dbUpdates.friend_name = updates.name;
    if (updates.email !== undefined) dbUpdates.friend_email = updates.email;
    if (updates.status) dbUpdates.status = updates.status;
    
    const { error } = await supabase
      .from('friendships')
      .update(dbUpdates)
      .eq('id', id);
    
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
    
    // 1. Update the original request to 'connected'
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ status: 'connected' })
      .eq('id', friendshipId);
    
    if (updateError) {
      console.error('Error accepting friend request:', updateError);
      return;
    }
    
    // 2. Get the requester's profile for their name
    const { data: requesterProfile } = await supabase
      .from('public_profiles')
      .select('display_name')
      .eq('user_id', requesterUserId)
      .maybeSingle();
    
    // 3. Create a reciprocal friendship record for the accepter
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        user_id: userId,
        friend_user_id: requesterUserId,
        friend_name: requesterProfile?.display_name || 'Friend',
        status: 'connected',
      });
    
    if (insertError) {
      console.error('Error creating reciprocal friendship:', insertError);
      // Don't return - the original update succeeded
    }
    
    // 4. Update local state - change the incoming request to connected
    set((state) => ({
      friends: state.friends.map((f) => 
        f.id === friendshipId ? { ...f, status: 'connected' as const } : f
      ),
    }));
  },
  
  removeFriend: async (id) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', id);
    
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
