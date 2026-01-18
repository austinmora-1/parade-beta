import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, isPast, isSameDay } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  MapPin, 
  Calendar, 
  Settings, 
  Loader2,
  Users,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot, ActivityType } from '@/types/planner';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_address: string | null;
}

export default function Profile() {
  const { session } = useAuth();
  const { plans, friends } = usePlannerStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, bio, home_address')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
        }

        setProfile(data);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session?.user]);

  // Get past plans (hangout history)
  const pastPlans = plans
    .filter(plan => isPast(plan.date) && !isSameDay(plan.date, new Date()))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10); // Show last 10 hangouts

  // Get connected friends count
  const connectedFriendsCount = friends.filter(f => f.status === 'connected').length;

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Extract city from address
  const getCity = (address: string | null | undefined) => {
    if (!address) return null;
    // Try to extract city - usually after the first comma or just the first part
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return parts[0].trim();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 md:h-32" />
        
        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="-mt-12 mb-4 flex items-end justify-between md:-mt-16">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg md:h-32 md:w-32">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
              <AvatarFallback className="bg-primary text-2xl text-primary-foreground md:text-3xl">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </div>

          {/* Name & Bio */}
          <div className="space-y-3">
            <div>
              <h1 className="font-display text-2xl font-bold md:text-3xl">
                {profile?.display_name || 'Your Name'}
              </h1>
              {getCity(profile?.home_address) && (
                <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{getCity(profile?.home_address)}</span>
                </div>
              )}
            </div>

            {profile?.bio ? (
              <p className="text-muted-foreground">{profile.bio}</p>
            ) : (
              <p className="text-muted-foreground italic">
                No bio yet. <Link to="/settings" className="text-primary hover:underline">Add one in settings</Link>
              </p>
            )}

            {/* Quick Stats */}
            <div className="flex gap-6 pt-2">
              <div className="text-center">
                <p className="font-display text-xl font-bold">{connectedFriendsCount}</p>
                <p className="text-sm text-muted-foreground">Friends</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-bold">{pastPlans.length}</p>
                <p className="text-sm text-muted-foreground">Hangouts</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-bold">{plans.filter(p => !isPast(p.date) || isSameDay(p.date, new Date())).length}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hangout History */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Hangout History</h2>
          </div>
          <Link to="/plans">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>

        {pastPlans.length > 0 ? (
          <div className="space-y-3">
            {pastPlans.map((plan) => {
              const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG];
              return (
                <div
                  key={plan.id}
                  className="flex items-center gap-4 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                >
                  <div 
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: activityConfig ? `hsl(var(--${activityConfig.color}) / 0.2)` : 'hsl(var(--muted))' }}
                  >
                    {activityConfig?.icon || '📅'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{plan.title}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(plan.date, 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>{TIME_SLOT_LABELS[plan.timeSlot as TimeSlot]?.label || plan.timeSlot}</span>
                      {plan.location && (
                        <>
                          <span>•</span>
                          <span className="truncate">{plan.location.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {plan.participants && plan.participants.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{plan.participants.length}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No hangouts yet</h3>
            <p className="text-muted-foreground mb-4">
              Your past hangouts will appear here
            </p>
            <Link to="/plans">
              <Button>Create Your First Plan</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
