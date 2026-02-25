import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MessageCircle, Send, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek } from 'date-fns';
import { TimeSlot, TIME_SLOT_LABELS } from '@/types/planner';

const TIME_SLOT_ORDER: TimeSlot[] = [
  'early-morning', 'late-morning', 'early-afternoon',
  'late-afternoon', 'evening', 'late-night',
];

const SLOT_TO_DB_COL: Record<TimeSlot, string> = {
  'early-morning': 'early_morning',
  'late-morning': 'late_morning',
  'early-afternoon': 'early_afternoon',
  'late-afternoon': 'late_afternoon',
  'evening': 'evening',
  'late-night': 'late_night',
};

interface FriendProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  current_vibe: string | null;
  location_status: string | null;
}

interface AvailabilityDay {
  date: string;
  slots: Record<TimeSlot, boolean>;
  location_status: string | null;
  trip_location: string | null;
}

export default function FriendProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<FriendProfileData | null>(null);
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch profile from public_profiles view
      const { data: profileData } = await supabase
        .from('public_profiles')
        .select('display_name, avatar_url, bio')
        .eq('user_id', userId)
        .single();

      // Fetch additional profile data (vibe, location) - works if show_availability is true
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('current_vibe, location_status')
        .eq('user_id', userId)
        .single();

      setProfile({
        display_name: profileData?.display_name || null,
        avatar_url: profileData?.avatar_url || null,
        bio: profileData?.bio || null,
        current_vibe: fullProfile?.current_vibe || null,
        location_status: fullProfile?.location_status || null,
      });

      // Fetch availability for the next 7 days
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekOut = format(addDays(new Date(), 6), 'yyyy-MM-dd');

      const { data: availData } = await supabase
        .from('availability')
        .select('date, early_morning, late_morning, early_afternoon, late_afternoon, evening, late_night, location_status, trip_location')
        .eq('user_id', userId)
        .gte('date', today)
        .lte('date', weekOut)
        .order('date');

      if (availData) {
        const mapped: AvailabilityDay[] = availData.map((row: any) => ({
          date: row.date,
          slots: Object.fromEntries(
            TIME_SLOT_ORDER.map(slot => [slot, row[SLOT_TO_DB_COL[slot]] !== false])
          ) as Record<TimeSlot, boolean>,
          location_status: row.location_status,
          trip_location: row.trip_location,
        }));
        setAvailability(mapped);
      }

      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const next7Days = useMemo(() => {
    const days: { date: Date; label: string; dateStr: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      days.push({
        date: d,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(d, 'EEE'),
        dateStr: format(d, 'yyyy-MM-dd'),
      });
    }
    return days;
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="animate-fade-in space-y-4 text-center py-12">
        <p className="text-4xl">🔒</p>
        <h2 className="font-display text-lg font-semibold">Profile not available</h2>
        <p className="text-sm text-muted-foreground">This user's profile is private or doesn't exist.</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 md:h-20 md:w-20">
          <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name || 'User'} />
          <AvatarFallback className="bg-primary/20 text-primary text-lg md:text-xl font-display font-semibold">
            {getInitials(profile.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold md:text-2xl truncate">
            {profile.display_name || 'User'}
          </h1>
          {profile.bio && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {profile.current_vibe && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                ✨ {profile.current_vibe}
              </span>
            )}
            {profile.location_status && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {profile.location_status === 'home' ? 'Home' : 'Away'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Availability Grid */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft md:p-6">
        <h2 className="mb-4 font-display text-base font-semibold md:text-lg">
          This Week's Availability
        </h2>

        {availability.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm text-muted-foreground">
              No availability shared for this week
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[500px]">
              {/* Header row */}
              <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-1 mb-2">
                <div />
                {next7Days.map(day => (
                  <div key={day.dateStr} className="text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">{day.label}</p>
                    <p className="text-xs font-semibold">{format(day.date, 'd')}</p>
                  </div>
                ))}
              </div>

              {/* Slot rows */}
              {TIME_SLOT_ORDER.map(slot => (
                <div key={slot} className="grid grid-cols-[100px_repeat(7,1fr)] gap-1 mb-1">
                  <div className="flex items-center">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {TIME_SLOT_LABELS[slot].label}
                    </span>
                  </div>
                  {next7Days.map(day => {
                    const dayAvail = availability.find(a => a.date === day.dateStr);
                    const isAvailable = dayAvail ? dayAvail.slots[slot] : false;
                    
                    return (
                      <div
                        key={`${day.dateStr}-${slot}`}
                        className={cn(
                          "h-7 rounded-md transition-colors",
                          isAvailable
                            ? "bg-availability-available/30 border border-availability-available/40"
                            : "bg-muted/50 border border-transparent"
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => navigate('/chat')}
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </Button>
      </div>
    </div>
  );
}
