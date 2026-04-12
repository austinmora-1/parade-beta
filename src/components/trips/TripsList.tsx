import { useEffect, useState } from 'react';
import { format, differenceInDays, isAfter, startOfDay } from 'date-fns';
import { Plane, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Trip {
  id: string;
  location: string | null;
  start_date: string;
  end_date: string;
  priority_friend_ids: string[];
  available_slots: string[];
}

interface TripsListProps {
  refreshKey?: number;
}

export function TripsList({ refreshKey }: TripsListProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTrips = async () => {
      setLoading(true);
      const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .gte('end_date', today)
        .order('start_date', { ascending: true });

      if (!error && data) {
        setTrips(data);
      }
      setLoading(false);
    };
    fetchTrips();
  }, [user, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground text-sm">Loading trips...</div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <Plane className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">No upcoming trips</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Add a trip from the button above to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trips.map((trip) => {
        const startDate = new Date(trip.start_date + 'T00:00:00');
        const endDate = new Date(trip.end_date + 'T00:00:00');
        const duration = differenceInDays(endDate, startDate) + 1;
        const isOngoing = !isAfter(startOfDay(startDate), startOfDay(new Date()));

        return (
          <button
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft",
              "hover:bg-muted/50 transition-colors text-left group"
            )}
          >
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
              isOngoing ? "bg-primary/15 text-primary" : "bg-availability-away/15 text-availability-away"
            )}>
              <Plane className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sm truncate">
                  {trip.location || 'Unknown destination'}
                </span>
                {isOngoing && (
                  <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full shrink-0">
                    NOW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(startDate, 'MMM d')} – {format(endDate, 'MMM d')}
                </span>
                <span>·</span>
                <span>{duration} {duration === 1 ? 'day' : 'days'}</span>
                {trip.priority_friend_ids.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{trip.priority_friend_ids.length} {trip.priority_friend_ids.length === 1 ? 'friend' : 'friends'}</span>
                  </>
                )}
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
