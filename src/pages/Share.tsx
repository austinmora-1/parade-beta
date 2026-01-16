import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay, isToday, isWeekend } from 'date-fns';
import { MapPin, Sparkles, Calendar, Home, Building2, Car, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TIME_SLOT_LABELS, TimeSlot, VIBE_CONFIG, VibeType } from '@/types/planner';
import paradeLogo from '@/assets/parade-logo.png';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  current_vibe: string | null;
  custom_vibe_tags: string[] | null;
  location_status: string | null;
}

interface AvailabilityData {
  date: string;
  early_morning: boolean | null;
  late_morning: boolean | null;
  early_afternoon: boolean | null;
  late_afternoon: boolean | null;
  evening: boolean | null;
  late_night: boolean | null;
}

const LOCATION_CONFIG = {
  home: { label: 'At Home', icon: Home, color: 'text-blue-500' },
  office: { label: 'At Office', icon: Building2, color: 'text-purple-500' },
  traveling: { label: 'Traveling', icon: Car, color: 'text-orange-500' },
};

export default function Share() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get weekend-focused week (show current week, highlighting Fri-Sun)
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError('No user specified');
        setLoading(false);
        return;
      }

      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, current_vibe, custom_vibe_tags, location_status')
          .eq('user_id', userId)
          .single();

        if (profileError) {
          setError('This user has not enabled sharing');
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch availability for the week
        const startDate = format(weekDays[0], 'yyyy-MM-dd');
        const endDate = format(weekDays[6], 'yyyy-MM-dd');

        const { data: availData } = await supabase
          .from('availability')
          .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate);

        setAvailability(availData || []);
      } catch (err) {
        console.error('Error fetching share data:', err);
        setError('Failed to load availability');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, weekDays]);

  const getSlotAvailable = (date: Date, slot: TimeSlot): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availability.find((a) => a.date === dateStr);
    if (!dayAvail) return true; // Default to available

    // Map TimeSlot (with hyphens) to database columns (with underscores)
    const slotMap: Record<TimeSlot, keyof AvailabilityData> = {
      'early-morning': 'early_morning',
      'late-morning': 'late_morning',
      'early-afternoon': 'early_afternoon',
      'late-afternoon': 'late_afternoon',
      'evening': 'evening',
      'late-night': 'late_night',
    };

    return dayAvail[slotMap[slot]] !== false;
  };

  // Calculate day availability percentage
  const getDayAvailability = (date: Date): number => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableCount = slots.filter((slot) => getSlotAvailable(date, slot)).length;
    return availableCount / slots.length;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-background via-background to-primary/5 p-6">
        <div className="rounded-2xl bg-card p-8 text-center shadow-lg">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {error || 'User not found'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            This availability page is not available.
          </p>
          <Link
            to="/landing"
            className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Parade
          </Link>
        </div>
      </div>
    );
  }

  const locationConfig = profile.location_status
    ? LOCATION_CONFIG[profile.location_status as keyof typeof LOCATION_CONFIG]
    : null;
  const LocationIcon = locationConfig?.icon;

  const vibeConfig = profile.current_vibe
    ? VIBE_CONFIG[profile.current_vibe as VibeType]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <img src={paradeLogo} alt="Parade" className="h-8" />
          <Link
            to="/landing"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Parade
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Profile Card */}
        <div className="mb-6 rounded-2xl bg-card p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-primary/10">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || 'User'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                  {(profile.display_name || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">
                {profile.display_name || 'User'}'s Availability
              </h1>
              <p className="text-muted-foreground">See when I'm free this week!</p>
            </div>
          </div>

          {/* Status Row */}
          <div className="mt-4 flex flex-wrap gap-3">
            {/* Location Status */}
            {locationConfig && LocationIcon && (
              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5">
                <LocationIcon className={cn('h-4 w-4', locationConfig.color)} />
                <span className="text-sm font-medium">{locationConfig.label}</span>
              </div>
            )}

            {/* Vibe Status */}
            {vibeConfig && (
              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5">
                <span>{vibeConfig.icon}</span>
                <span className="text-sm font-medium">{vibeConfig.label}</span>
              </div>
            )}

            {/* Custom Vibe Tags */}
            {profile.current_vibe === 'custom' &&
              profile.custom_vibe_tags?.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 px-3 py-1.5"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-sm font-medium">#{tag}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Availability Grid - Weekend Focused */}
        <div className="rounded-2xl bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">This Week</h2>
          </div>

          {/* Day Headers */}
          <div className="mb-3 grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isWeekendDay = isWeekend(day);
              const dayAvail = getDayAvailability(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'flex flex-col items-center rounded-lg p-2 text-center',
                    isWeekendDay && 'bg-primary/5 ring-1 ring-primary/20',
                    isToday(day) && 'bg-primary text-primary-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs font-medium uppercase',
                      isToday(day) ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn('text-lg font-bold', isToday(day) && 'text-primary-foreground')}>
                    {format(day, 'd')}
                  </span>
                  {/* Availability indicator */}
                  <div
                    className={cn(
                      'mt-1 h-1.5 w-8 rounded-full',
                      dayAvail > 0.5 && 'bg-availability-available',
                      dayAvail > 0 && dayAvail <= 0.5 && 'bg-yellow-400',
                      dayAvail === 0 && 'bg-muted'
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Time Slots Grid */}
          <div className="space-y-1">
            {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
              <div key={slot} className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => {
                  const available = getSlotAvailable(day, slot);
                  const isWeekendDay = isWeekend(day);
                  return (
                    <div
                      key={`${day.toISOString()}-${slot}`}
                      className={cn(
                        'h-6 rounded transition-colors',
                        available ? 'bg-availability-available/30' : 'bg-muted/40',
                        isWeekendDay && available && 'bg-availability-available/50'
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Time Labels */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
              <span key={slot}>
                {TIME_SLOT_LABELS[slot].label}: {TIME_SLOT_LABELS[slot].time}
              </span>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 border-t border-border/50 pt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-availability-available/40" />
              <span className="text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-muted/40" />
              <span className="text-muted-foreground">Busy</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Want to share your own availability with friends?
          </p>
          <Link
            to="/landing"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-medium text-primary-foreground shadow-md hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            Get Parade - It's Free!
          </Link>
        </div>
      </main>
    </div>
  );
}
