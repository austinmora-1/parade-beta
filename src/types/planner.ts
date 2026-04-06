import type { LucideIcon } from 'lucide-react';

export type VibeType = 'social' | 'chill' | 'athletic' | 'productive' | 'custom';

export type ActivityType = 
  // Social activities
  | 'drinks'
  | 'hanging-out'
  | 'museum'
  | 'sightseeing'
  | 'dinner'
  | 'concert'
  | 'one-on-one'
  | 'beach'
  | 'stand-up-comedy'
  | 'people-watching'
  | 'get-off-lawn'
  | 'theme-park'
  | 'camping'
  | 'video-games'
  | 'facetime'
  | 'sports-event'
  | 'larping'
  | 'ballet'
  | 'dancing'
  | 'opera'
  | 'comic-con'
  // Chill activities
  | 'listening-music'
  | 'watching-movie'
  | 'park'
  | 'watching-tv'
  | 'grilling'
  | 'movies'
  | 'black-hole'
  | 'reading'
  // Athletic activities
  | 'surfing'
  | 'jaywalking'
  | 'gym'
  | 'yoga'
  | 'running'
  | 'workout-in'
  | 'swimming'
  | 'hiking'
  // Productive activities
  | 'feeding-pets'
  | 'hydrating'
  | 'walking-dog'
  | 'volunteering'
  | 'wine-tasting'
  | 'amateur-djing'
  | 'flight'
  | 'shopping'
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

export type ParticipantRole = 'participant' | 'subscriber';
export type PlanStatus = 'confirmed' | 'tentative' | 'cancelled' | 'proposed';
export type FeedVisibility = 'private' | 'friends' | string; // string for 'pod:<id>'

export interface Friend {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  friendUserId?: string;
  status: 'connected' | 'pending' | 'invited';
  isIncoming?: boolean;
  role?: ParticipantRole;
  isPodMember?: boolean;
  rsvpStatus?: string; // 'accepted' | 'declined' | 'maybe' | 'invited'
  respondedAt?: Date;
}

export interface Plan {
  id: string;
  userId?: string; // owner of the plan
  title: string;
  activity: ActivityType | string; // Allow custom activity IDs
  location?: Location;
  date: Date;
  endDate?: Date; // For multi-day plans
  timeSlot: TimeSlot;
  duration: number;
  startTime?: string; // HH:mm format e.g. "14:30"
  endTime?: string;   // HH:mm format e.g. "16:00"
  participants: Friend[];
  notes?: string;
  status: PlanStatus;
  feedVisibility?: FeedVisibility;
  createdAt: Date;
  myRole?: ParticipantRole; // role of the current user (for participated plans)
  myRsvpStatus?: string; // current user's RSVP status: 'accepted' | 'maybe' | 'declined' | 'invited'
  recurringPlanId?: string; // linked to a recurring plan template
  proposedBy?: string; // user_id of the proposer; undefined for self-created plans
}

export interface Vibe {
  type: VibeType;
  customText?: string;
  customTags?: string[];
  gifUrl?: string;
}

export interface DayAvailability {
  date: Date;
  slots: {
    [key in TimeSlot]: boolean;
  };
  locationStatus: LocationStatus;
  customLocation?: Location;
  tripLocation?: string;
  vibe?: VibeType | null;
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

import { Wine, Sparkles, Landmark, Compass, Utensils, Music, User, Umbrella, Smile, Eye, Megaphone, Tent, Gamepad2, Video, Trophy, Sword, Drama, PartyPopper, Theater, Zap, Headphones, Clapperboard, TreePine, Tv, Flame, Film, BookOpen, Waves as WavesIcon, Footprints, Dumbbell, PersonStanding, Home, Mountain, PawPrint, GlassWater, Dog, Heart, Disc3, Plane, ShoppingBag } from 'lucide-react';

export const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  // Social activities (ranked)
  'drinks': { label: 'Getting Drinks', icon: '🍹', lucideIcon: Wine, color: 'activity-drinks', vibeType: 'social' },
  'hanging-out': { label: 'Hanging Out', icon: '🤙', lucideIcon: Smile, color: 'activity-events', vibeType: 'social' },
  'museum': { label: 'Going to a Museum', icon: '🏛️', lucideIcon: Landmark, color: 'activity-events', vibeType: 'social' },
  'sightseeing': { label: 'Sightseeing', icon: '🧭', lucideIcon: Compass, color: 'activity-events', vibeType: 'social' },
  'dinner': { label: 'Getting Dinner', icon: '🍽️', lucideIcon: Utensils, color: 'activity-food', vibeType: 'social' },
  'concert': { label: 'Concert', icon: '🎵', lucideIcon: Music, color: 'activity-events', vibeType: 'social' },
  'one-on-one': { label: '1:1 Time', icon: '👥', lucideIcon: User, color: 'activity-events', vibeType: 'social' },
  'beach': { label: 'Going to the Beach', icon: '🏖️', lucideIcon: Umbrella, color: 'activity-events', vibeType: 'social' },
  'stand-up-comedy': { label: 'Stand-up Comedy', icon: '🎤', lucideIcon: Megaphone, color: 'activity-events', vibeType: 'social' },
  'people-watching': { label: 'People Watching', icon: '👀', lucideIcon: Eye, color: 'activity-events', vibeType: 'social' },
  'get-off-lawn': { label: 'Get Off My Lawn', icon: '🌿', lucideIcon: Megaphone, color: 'activity-events', vibeType: 'social' },
  'theme-park': { label: 'Theme Park', icon: '🎢', lucideIcon: Zap, color: 'activity-events', vibeType: 'social' },
  'camping': { label: 'Camping', icon: '⛺', lucideIcon: Tent, color: 'activity-events', vibeType: 'social' },
  'video-games': { label: 'Video Games', icon: '🎮', lucideIcon: Gamepad2, color: 'activity-events', vibeType: 'social' },
  'facetime': { label: 'Facetime', icon: '📱', lucideIcon: Video, color: 'activity-events', vibeType: 'social' },
  'sports-event': { label: 'Going to a Game', icon: '🏟️', lucideIcon: Trophy, color: 'activity-events', vibeType: 'social' },
  'larping': { label: 'LARPing', icon: '⚔️', lucideIcon: Sword, color: 'activity-events', vibeType: 'social' },
  'ballet': { label: 'Ballet / Dance', icon: '🩰', lucideIcon: Drama, color: 'activity-events', vibeType: 'social' },
  'dancing': { label: 'Dancing', icon: '💃', lucideIcon: PartyPopper, color: 'activity-events', vibeType: 'social' },
  'opera': { label: 'Opera', icon: '🎭', lucideIcon: Theater, color: 'activity-events', vibeType: 'social' },
  'comic-con': { label: 'Comic-Con', icon: '🦸', lucideIcon: Zap, color: 'activity-events', vibeType: 'social' },
  // Chill activities (ranked)
  'listening-music': { label: 'Listening to Music', icon: '🎧', lucideIcon: Headphones, color: 'activity-me-time', vibeType: 'chill' },
  'watching-movie': { label: 'Watching a Movie', icon: '🎬', lucideIcon: Clapperboard, color: 'activity-movies', vibeType: 'chill' },
  'park': { label: 'Going to the Park', icon: '🌳', lucideIcon: TreePine, color: 'activity-me-time', vibeType: 'chill' },
  'watching-tv': { label: 'Watching TV', icon: '📺', lucideIcon: Tv, color: 'activity-watching', vibeType: 'chill' },
  'grilling': { label: 'Grilling', icon: '🔥', lucideIcon: Flame, color: 'activity-food', vibeType: 'chill' },
  'movies': { label: 'Going to the Movies', icon: '🎥', lucideIcon: Film, color: 'activity-movies', vibeType: 'chill' },
  'black-hole': { label: 'In a Black Hole', icon: '🕳️', lucideIcon: Sparkles, color: 'activity-me-time', vibeType: 'chill' },
  'reading': { label: 'Reading', icon: '📚', lucideIcon: BookOpen, color: 'activity-reading', vibeType: 'chill' },
  // Athletic activities (ranked)
  'surfing': { label: 'Surfing', icon: '🏄', lucideIcon: WavesIcon, color: 'activity-workout', vibeType: 'athletic' },
  'jaywalking': { label: 'Jaywalking', icon: '🚶', lucideIcon: Footprints, color: 'activity-workout', vibeType: 'athletic' },
  'gym': { label: 'Going to the Gym', icon: '🏋️', lucideIcon: Dumbbell, color: 'activity-workout', vibeType: 'athletic' },
  'yoga': { label: 'Yoga', icon: '🧘‍♀️', lucideIcon: PersonStanding, color: 'activity-workout', vibeType: 'athletic' },
  'running': { label: 'Running', icon: '🏃‍♂️', lucideIcon: Run, color: 'activity-workout', vibeType: 'athletic' },
  'workout-in': { label: 'Working Out at Home', icon: '🏠💪', lucideIcon: Home, color: 'activity-workout', vibeType: 'athletic' },
  'swimming': { label: 'Swimming', icon: '🏊', lucideIcon: WavesIcon, color: 'activity-workout', vibeType: 'athletic' },
  'hiking': { label: 'Hiking', icon: '🥾', lucideIcon: Mountain, color: 'activity-workout', vibeType: 'athletic' },
  // Productive activities (ranked)
  'feeding-pets': { label: 'Feeding the Pets', icon: '🐾', lucideIcon: PawPrint, color: 'activity-chores', vibeType: 'productive' },
  'hydrating': { label: 'Hydrating', icon: '💧', lucideIcon: GlassWater, color: 'activity-chores', vibeType: 'productive' },
  'walking-dog': { label: 'Walking the Dog', icon: '🐕', lucideIcon: Dog, color: 'activity-chores', vibeType: 'productive' },
  'volunteering': { label: 'Volunteering', icon: '🤝', lucideIcon: Heart, color: 'activity-errands', vibeType: 'productive' },
  'wine-tasting': { label: 'Wine Tasting', icon: '🍷', lucideIcon: Wine, color: 'activity-errands', vibeType: 'productive' },
  'amateur-djing': { label: 'Amateur DJing', icon: '🎧', lucideIcon: Disc3, color: 'activity-errands', vibeType: 'productive' },
  'flight': { label: 'Flight', icon: '✈️', lucideIcon: Plane, color: 'activity-events', vibeType: 'productive' },
  'shopping': { label: 'Shopping', icon: '🛍️', lucideIcon: ShoppingBag, color: 'activity-shopping', vibeType: 'productive' },
  // Custom placeholder
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
