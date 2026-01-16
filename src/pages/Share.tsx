import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay, isToday } from 'date-fns';
import { Sparkles, Calendar, Home, Building2, Car, Loader2, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { TIME_SLOT_LABELS, TimeSlot, VIBE_CONFIG, VibeType, ACTIVITY_CONFIG } from '@/types/planner';
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

interface PlanData {
  id: string;
  title: string;
  activity: string;
  date: string;
  time_slot: string;
  duration: number;
  location: string | null;
}

const LOCATION_CONFIG = {
  home: { label: 'At Home', icon: Home, color: 'text-blue-500' },
  office: { label: 'At Office', icon: Building2, color: 'text-purple-500' },
  traveling: { label: 'Traveling', icon: Car, color: 'text-orange-500' },
};

export default function Share() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData[]>([]);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!shareCode) {
        setError('No share code specified');
        setLoading(false);
        return;
      }

      try {
        // Fetch profile by share_code
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url, current_vibe, custom_vibe_tags, location_status')
          .eq('share_code', shareCode)
          .single();

        if (profileError || !profileData) {
          setError('This share link is not valid');
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
          .eq('user_id', profileData.user_id)
          .gte('date', startDate)
          .lte('date', endDate);

        setAvailability(availData || []);

        // Fetch plans for the week
        const { data: plansData } = await supabase
          .from('plans')
          .select('id, title, activity, date, time_slot, duration, location')
          .eq('user_id', profileData.user_id)
          .gte('date', weekDays[0].toISOString())
          .lte('date', weekDays[6].toISOString())
          .order('date', { ascending: true });

        setPlans(plansData || []);
      } catch (err) {
        console.error('Error fetching share data:', err);
        setError('Failed to load availability');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shareCode, weekDays]);

  const getSlotStatus = (date: Date, slot: TimeSlot): 'available' | 'busy' | 'plan' => {
    // Check if there's a plan during this slot
    const hasPlan = plans.some(
      (p) => isSameDay(new Date(p.date), date) && p.time_slot === slot
    );
    
    if (hasPlan) return 'plan';
    
    // Check availability setting
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvail = availability.find((a) => a.date === dateStr);
    
    if (!dayAvail) return 'available'; // Default to available
    
    const slotMap: Record<TimeSlot, keyof AvailabilityData> = {
      'early-morning': 'early_morning',
      'late-morning': 'late_morning',
      'early-afternoon': 'early_afternoon',
      'late-afternoon': 'late_afternoon',
      'evening': 'evening',
      'late-night': 'late_night',
    };
    
    return dayAvail[slotMap[slot]] === false ? 'busy' : 'available';
  };

  const getDayAvailabilityScore = (date: Date): number => {
    const slots = Object.keys(TIME_SLOT_LABELS) as TimeSlot[];
    const availableSlots = slots.filter(
      (slot) => getSlotStatus(date, slot) === 'available'
    ).length;
    return availableSlots / slots.length;
  };

  const getPlansForDay = (date: Date): PlanData[] => {
    return plans.filter((p) => isSameDay(new Date(p.date), date));
  };

  // Get upcoming plans (today and future)
  const upcomingPlans = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return plans
      .filter((p) => new Date(p.date) >= today)
      .slice(0, 5);
  }, [plans]);

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

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="rounded-2xl bg-card p-6 shadow-soft">
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
                {profile.display_name || 'User'}'s Week
              </h1>
              <p className="text-muted-foreground">See what I'm up to!</p>
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

        {/* Week Overview - Similar to Dashboard */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">This Week</h3>
            <span className="text-sm text-muted-foreground">
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d')}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4">
            {weekDays.map((day) => {
              const score = getDayAvailabilityScore(day);
              const isTodayDay = isToday(day);
              const dayPlans = getPlansForDay(day);
              const planCount = dayPlans.length;
              
              return (
                <div
                  key={day.toISOString()}
                  className="flex flex-col items-center rounded-xl p-2 transition-all duration-200"
                >
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {format(day, 'EEE')}
                  </span>
                  
                  {/* Date circle with plan count bubble */}
                  <div className="relative">
                    {/* Date circle */}
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      isTodayDay 
                        ? "bg-availability-today text-white"
                        : score >= 0.7 
                          ? "bg-availability-available-light text-availability-available"
                          : score >= 0.3 && score < 0.7 
                            ? "bg-availability-partial-light text-availability-partial"
                            : "bg-availability-busy-light text-availability-busy"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Plan count bubble */}
                    {planCount > 0 && (
                      <span className={cn(
                        "absolute -bottom-3 left-1/2 -translate-x-1/2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                        score >= 0.7 && "bg-availability-available text-white",
                        score >= 0.3 && score < 0.7 && "bg-availability-partial text-white",
                        score < 0.3 && "bg-availability-busy text-white"
                      )}>
                        {planCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Plans */}
        {upcomingPlans.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-semibold">Upcoming Plans</h3>
            </div>

            <div className="space-y-3">
            {upcomingPlans.map((plan) => {
                const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG];
                const activityIcon = activityConfig?.icon || '📅';
                const timeLabel = TIME_SLOT_LABELS[plan.time_slot as TimeSlot]?.label || plan.time_slot;
                
                return (
                  <div
                    key={plan.id}
                    className="flex items-start gap-3 rounded-xl bg-muted/30 p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                      {activityIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{plan.title}</h4>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(plan.date), 'EEE, MMM d')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeLabel}
                        </span>
                        {plan.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{plan.location.split(',')[0]}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-availability-available" />
            <span>Mostly Free</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-availability-partial" />
            <span>Partially Free</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-availability-busy" />
            <span>Busy</span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-2">
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
