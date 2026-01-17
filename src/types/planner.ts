export type ActivityCategory = 'staying-in' | 'going-out';

export type ActivityType = 
  // Staying in
  | 'me-time'
  | 'chores'
  | 'workout-in'
  | 'making-food'
  | 'reading'
  | 'watching'
  // Going out
  | 'getting-food'
  | 'drinks'
  | 'events'
  | 'other-events'
  | 'errands'
  | 'workout-out'
  | 'coffee'
  | 'movies'
  | 'shopping'
  | 'doctor';

export type TimeSlot = 'early-morning' | 'late-morning' | 'early-afternoon' | 'late-afternoon' | 'evening' | 'late-night';

export type VibeType = 'social' | 'chill' | 'athletic' | 'custom';

export type LocationStatus = 'home' | 'away';

export interface Location {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
}

export interface Friend {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  friendUserId?: string; // The user_id of the friend if they're an app user
  status: 'connected' | 'pending' | 'invited';
}

export interface Plan {
  id: string;
  title: string;
  activity: ActivityType;
  location?: Location;
  date: Date;
  timeSlot: TimeSlot;
  duration: number; // in minutes
  participants: Friend[];
  notes?: string;
  createdAt: Date;
}

export interface Vibe {
  type: VibeType;
  customText?: string;
  customTags?: string[];
}

export interface DayAvailability {
  date: Date;
  slots: {
    [key in TimeSlot]: boolean;
  };
  locationStatus: LocationStatus;
  customLocation?: Location;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  defaultLocation?: Location;
  currentVibe?: Vibe;
  friends: Friend[];
}

export const TIME_SLOT_LABELS: Record<TimeSlot, { label: string; time: string }> = {
  'early-morning': { label: 'Early Morning', time: '6-9am' },
  'late-morning': { label: 'Morning', time: '9am-12pm' },
  'early-afternoon': { label: 'Midday', time: '12-3pm' },
  'late-afternoon': { label: 'Afternoon', time: '3-6pm' },
  'evening': { label: 'Evening', time: '6-10pm' },
  'late-night': { label: 'Late Night', time: '10pm-2am' },
};

export interface ActivityConfig {
  label: string;
  icon: string;
  color: string;
  category: ActivityCategory;
}

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; icon: string }> = {
  'staying-in': { label: 'Staying In', icon: '🏠' },
  'going-out': { label: 'Going Out', icon: '🚀' },
};

export const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  // Staying in
  'me-time': { label: 'Me Time', icon: '🧘', color: 'activity-me-time', category: 'staying-in' },
  'chores': { label: 'Chores', icon: '🧹', color: 'activity-chores', category: 'staying-in' },
  'workout-in': { label: 'Doing a Workout', icon: '💪', color: 'activity-workout', category: 'staying-in' },
  'making-food': { label: 'Making Food', icon: '👨‍🍳', color: 'activity-food', category: 'staying-in' },
  'reading': { label: 'Reading', icon: '📚', color: 'activity-reading', category: 'staying-in' },
  'watching': { label: 'Watching Something', icon: '📺', color: 'activity-watching', category: 'staying-in' },
  // Going out
  'getting-food': { label: 'Getting Food', icon: '🍽️', color: 'activity-food', category: 'going-out' },
  'drinks': { label: 'The Met Gala', icon: '🍹', color: 'activity-drinks', category: 'going-out' },
  'events': { label: 'Events', icon: '🎉', color: 'activity-events', category: 'going-out' },
  'other-events': { label: 'Other Events', icon: '✨', color: 'activity-misc', category: 'going-out' },
  'errands': { label: 'Running Errands', icon: '🏃', color: 'activity-errands', category: 'going-out' },
  'workout-out': { label: 'Workout', icon: '🏋️', color: 'activity-workout', category: 'going-out' },
  'coffee': { label: 'Coffee', icon: '☕', color: 'activity-coffee', category: 'going-out' },
  'movies': { label: 'Going to the Movies', icon: '🎬', color: 'activity-movies', category: 'going-out' },
  'shopping': { label: 'Shopping', icon: '🛍️', color: 'activity-shopping', category: 'going-out' },
  'doctor': { label: 'Doctor Appointment', icon: '🏥', color: 'activity-doctor', category: 'going-out' },
};

export const getActivitiesByCategory = (category: ActivityCategory): ActivityType[] => {
  return (Object.keys(ACTIVITY_CONFIG) as ActivityType[]).filter(
    (type) => ACTIVITY_CONFIG[type].category === category
  );
};

export const VIBE_CONFIG: Record<VibeType, { label: string; icon: string; color: string }> = {
  social: { label: 'Social', icon: '🎉', color: 'vibe-social' },
  chill: { label: 'Chill', icon: '😌', color: 'vibe-chill' },
  athletic: { label: 'Athletic', icon: '💪', color: 'vibe-athletic' },
  custom: { label: 'Custom', icon: '✨', color: 'primary' },
};
