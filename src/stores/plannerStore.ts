import { create } from 'zustand';
import { Plan, Friend, DayAvailability, Vibe, TimeSlot, LocationStatus } from '@/types/planner';
import { addDays, startOfWeek, format } from 'date-fns';

interface PlannerState {
  plans: Plan[];
  friends: Friend[];
  availability: DayAvailability[];
  currentVibe: Vibe | null;
  locationStatus: LocationStatus;
  
  // Actions
  addPlan: (plan: Plan) => void;
  updatePlan: (id: string, updates: Partial<Plan>) => void;
  deletePlan: (id: string) => void;
  
  addFriend: (friend: Friend) => void;
  updateFriend: (id: string, updates: Partial<Friend>) => void;
  removeFriend: (id: string) => void;
  
  setAvailability: (date: Date, slot: TimeSlot, available: boolean) => void;
  setLocationStatus: (status: LocationStatus) => void;
  setVibe: (vibe: Vibe | null) => void;
  
  initializeWeekAvailability: () => void;
}

const createDefaultAvailability = (date: Date): DayAvailability => ({
  date,
  slots: {
    'early-morning': true,
    'late-morning': true,
    'early-afternoon': true,
    'late-afternoon': true,
    'evening': true,
    'late-night': true,
  },
  locationStatus: 'home',
});

export const usePlannerStore = create<PlannerState>((set, get) => ({
  plans: [
    {
      id: '1',
      title: 'Brunch with Sarah',
      activity: 'food',
      date: addDays(new Date(), 1),
      timeSlot: 'late-morning',
      duration: 90,
      participants: [{ id: '1', name: 'Sarah', status: 'connected' }],
      createdAt: new Date(),
    },
    {
      id: '2',
      title: 'Coffee catch-up',
      activity: 'coffee',
      date: addDays(new Date(), 2),
      timeSlot: 'early-afternoon',
      duration: 60,
      participants: [{ id: '2', name: 'Mike', status: 'connected' }],
      createdAt: new Date(),
    },
    {
      id: '3',
      title: 'Park run',
      activity: 'sports',
      date: addDays(new Date(), 3),
      timeSlot: 'early-morning',
      duration: 45,
      participants: [],
      createdAt: new Date(),
    },
  ],
  
  friends: [
    { id: '1', name: 'Sarah Chen', status: 'connected' },
    { id: '2', name: 'Mike Johnson', status: 'connected' },
    { id: '3', name: 'Emma Wilson', status: 'pending' },
    { id: '4', name: 'Alex Rivera', status: 'connected' },
  ],
  
  availability: [],
  currentVibe: { type: 'social' },
  locationStatus: 'home',
  
  addPlan: (plan) => set((state) => ({ plans: [...state.plans, plan] })),
  
  updatePlan: (id, updates) => set((state) => ({
    plans: state.plans.map((p) => p.id === id ? { ...p, ...updates } : p),
  })),
  
  deletePlan: (id) => set((state) => ({
    plans: state.plans.filter((p) => p.id !== id),
  })),
  
  addFriend: (friend) => set((state) => ({ friends: [...state.friends, friend] })),
  
  updateFriend: (id, updates) => set((state) => ({
    friends: state.friends.map((f) => f.id === id ? { ...f, ...updates } : f),
  })),
  
  removeFriend: (id) => set((state) => ({
    friends: state.friends.filter((f) => f.id !== id),
  })),
  
  setAvailability: (date, slot, available) => set((state) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingIndex = state.availability.findIndex(
      (a) => format(a.date, 'yyyy-MM-dd') === dateStr
    );
    
    if (existingIndex >= 0) {
      const updated = [...state.availability];
      updated[existingIndex] = {
        ...updated[existingIndex],
        slots: { ...updated[existingIndex].slots, [slot]: available },
      };
      return { availability: updated };
    }
    
    const newAvailability = createDefaultAvailability(date);
    newAvailability.slots[slot] = available;
    return { availability: [...state.availability, newAvailability] };
  }),
  
  setLocationStatus: (status) => set({ locationStatus: status }),
  
  setVibe: (vibe) => set({ currentVibe: vibe }),
  
  initializeWeekAvailability: () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const week: DayAvailability[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(createDefaultAvailability(addDays(start, i)));
    }
    set({ availability: week });
  },
}));
