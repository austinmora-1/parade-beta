export type ActivityType = 'food' | 'coffee' | 'drinks' | 'sports' | 'music' | 'nature' | 'misc';

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
  avatar?: string;
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
  'late-morning': { label: 'Late Morning', time: '9am-12pm' },
  'early-afternoon': { label: 'Early Afternoon', time: '12-3pm' },
  'late-afternoon': { label: 'Late Afternoon', time: '3-6pm' },
  'evening': { label: 'Evening', time: '6-10pm' },
  'late-night': { label: 'Late Night', time: '10pm-2am' },
};

export const ACTIVITY_CONFIG: Record<ActivityType, { label: string; icon: string; color: string }> = {
  food: { label: 'Food', icon: '🍽️', color: 'activity-food' },
  coffee: { label: 'Coffee', icon: '☕', color: 'activity-coffee' },
  drinks: { label: 'Drinks', icon: '🍹', color: 'activity-drinks' },
  sports: { label: 'Sports', icon: '⚽', color: 'activity-sports' },
  music: { label: 'Music', icon: '🎵', color: 'activity-music' },
  nature: { label: 'Nature & Parks', icon: '🌳', color: 'activity-nature' },
  misc: { label: 'Miscellaneous', icon: '✨', color: 'activity-misc' },
};

export const VIBE_CONFIG: Record<VibeType, { label: string; icon: string; color: string }> = {
  social: { label: 'Social', icon: '🎉', color: 'vibe-social' },
  chill: { label: 'Chill', icon: '😌', color: 'vibe-chill' },
  athletic: { label: 'Athletic', icon: '💪', color: 'vibe-athletic' },
  custom: { label: 'Custom', icon: '✨', color: 'primary' },
};
