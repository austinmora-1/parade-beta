import type { LucideIcon } from 'lucide-react';

export type VibeType = 'social' | 'chill' | 'athletic' | 'productive' | 'custom';

export type ActivityType = 
  // Social activities
  | 'drinks'
  | 'getting-food'
  | 'coffee'
  | 'events'
  | 'movies'
  | 'other-events'
  // Chill activities
  | 'me-time'
  | 'reading'
  | 'watching'
  | 'making-food'
  // Athletic activities
  | 'workout-in'
  | 'workout-out'
  // Productive activities
  | 'chores'
  | 'errands'
  | 'shopping'
  | 'doctor'
  // Travel
  | 'flight'
  // Custom (placeholder for user-defined)
  | 'custom';

export type TimeSlot = 'early-morning' | 'late-morning' | 'early-afternoon' | 'late-afternoon' | 'evening' | 'late-night';

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
  friendUserId?: string;
  status: 'connected' | 'pending' | 'invited';
  isIncoming?: boolean;
}

export interface Plan {
  id: string;
  userId?: string; // owner of the plan
  title: string;
  activity: ActivityType | string; // Allow custom activity IDs
  location?: Location;
  date: Date;
  timeSlot: TimeSlot;
  duration: number;
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
  tripLocation?: string;
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
  lucideIcon?: LucideIcon;
  color: string;
  vibeType: VibeType;
}

export interface CustomActivity {
  id: string;
  label: string;
  icon: string;
  vibeType: VibeType;
}

export const VIBE_CONFIG: Record<VibeType, { label: string; icon: string; color: string; description: string }> = {
  social: { label: 'Social', icon: '🎉', color: 'vibe-social', description: 'Hanging out with friends' },
  chill: { label: 'Chill', icon: '😌', color: 'vibe-chill', description: 'Relaxing and unwinding' },
  athletic: { label: 'Athletic', icon: '💪', color: 'vibe-athletic', description: 'Getting active' },
  productive: { label: 'Productive', icon: '🎯', color: 'vibe-productive', description: 'Getting things done' },
  custom: { label: 'Custom', icon: '✨', color: 'primary', description: 'Your own vibe' },
};

import { Wine, Utensils, Coffee, PartyPopper, Clapperboard, Sparkles, Flower2, BookOpen, Tv, ChefHat, Home, Dumbbell, Brush, Footprints, ShoppingBag, Stethoscope, Plane } from 'lucide-react';

export const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  // Social activities
  'drinks': { label: 'Drinks', icon: '🍹', lucideIcon: Wine, color: 'activity-drinks', vibeType: 'social' },
  'getting-food': { label: 'Getting Food', icon: '🍽️', lucideIcon: Utensils, color: 'activity-food', vibeType: 'social' },
  'coffee': { label: 'Coffee', icon: '☕', lucideIcon: Coffee, color: 'activity-coffee', vibeType: 'social' },
  'events': { label: 'Events', icon: '🎉', lucideIcon: PartyPopper, color: 'activity-events', vibeType: 'social' },
  'movies': { label: 'Movies', icon: '🎬', lucideIcon: Clapperboard, color: 'activity-movies', vibeType: 'social' },
  'other-events': { label: 'Other Events', icon: '✨', lucideIcon: Sparkles, color: 'activity-misc', vibeType: 'social' },
  // Chill activities
  'me-time': { label: 'Me Time', icon: '🧘', lucideIcon: Flower2, color: 'activity-me-time', vibeType: 'chill' },
  'reading': { label: 'Reading', icon: '📚', lucideIcon: BookOpen, color: 'activity-reading', vibeType: 'chill' },
  'watching': { label: 'Watching', icon: '📺', lucideIcon: Tv, color: 'activity-watching', vibeType: 'chill' },
  'making-food': { label: 'Cooking', icon: '👨‍🍳', lucideIcon: ChefHat, color: 'activity-food', vibeType: 'chill' },
  // Athletic activities
  'workout-in': { label: 'Home Workout', icon: '🏠💪', lucideIcon: Home, color: 'activity-workout', vibeType: 'athletic' },
  'workout-out': { label: 'Gym/Outdoor', icon: '🏋️', lucideIcon: Dumbbell, color: 'activity-workout', vibeType: 'athletic' },
  // Productive activities
  'chores': { label: 'Chores', icon: '🧹', lucideIcon: Brush, color: 'activity-chores', vibeType: 'productive' },
  'errands': { label: 'Errands', icon: '🏃', lucideIcon: Footprints, color: 'activity-errands', vibeType: 'productive' },
  'shopping': { label: 'Shopping', icon: '🛍️', lucideIcon: ShoppingBag, color: 'activity-shopping', vibeType: 'productive' },
  'doctor': { label: 'Appointment', icon: '🏥', lucideIcon: Stethoscope, color: 'activity-doctor', vibeType: 'productive' },
  // Travel
  'flight': { label: 'Flight', icon: '✈️', lucideIcon: Plane, color: 'activity-events', vibeType: 'social' },
  // Custom placeholder (not used directly, for type safety)
  'custom': { label: 'Custom', icon: '✨', lucideIcon: Sparkles, color: 'primary', vibeType: 'social' },
};

export const getActivitiesByVibe = (vibeType: VibeType): ActivityType[] => {
  return (Object.keys(ACTIVITY_CONFIG) as ActivityType[]).filter(
    (type) => type !== 'custom' && ACTIVITY_CONFIG[type].vibeType === vibeType
  );
};

export const getAllVibes = (): VibeType[] => {
  return ['social', 'chill', 'athletic', 'productive'];
};

// Helper to get activity config, including custom activities
export const getActivityConfig = (
  activityId: string, 
  customActivities: CustomActivity[] = []
): ActivityConfig | undefined => {
  // Check default activities first
  if (activityId in ACTIVITY_CONFIG) {
    return ACTIVITY_CONFIG[activityId as ActivityType];
  }
  // Check custom activities
  const customActivity = customActivities.find(a => a.id === activityId);
  if (customActivity) {
    return {
      label: customActivity.label,
      icon: customActivity.icon,
      color: `vibe-${customActivity.vibeType}`,
      vibeType: customActivity.vibeType,
    };
  }
  return undefined;
};

// Legacy support - map old category concept to new structure
export type ActivityCategory = 'staying-in' | 'going-out';
export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; icon: string }> = {
  'staying-in': { label: 'Staying In', icon: '🏠' },
  'going-out': { label: 'Going Out', icon: '🚀' },
};
export const getActivitiesByCategory = (category: ActivityCategory): ActivityType[] => {
  // Map old categories to vibes for backward compatibility
  if (category === 'staying-in') {
    return [...getActivitiesByVibe('chill'), 'workout-in', 'chores'];
  }
  return [...getActivitiesByVibe('social'), 'workout-out', 'errands', 'shopping', 'doctor'];
};
