import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plane, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCityForDisplay } from '@/lib/formatCity';

export interface ExistingTrip {
  id: string;
  location: string | null;
  start_date: string;
  end_date: string;
}

interface ExistingTripPickerProps {
  onSelect: (trip: ExistingTrip) => void;
}

export function ExistingTripPicker({ onSelect }: ExistingTripPickerProps) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<ExistingTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    supabase
      .from('trips')
      .select('id, location, start_date, end_date')
      .eq('user_id', user.id)
      .gte('end_date', todayKey)
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setTrips((data || []) as ExistingTrip[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <p className="text-xs text-muted-foreground text-center py-4">Loading trips…</p>;
  }
  if (trips.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No upcoming trips. Plan one first to use this option.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
      {trips.map(t => {
        const city = t.location ? formatCityForDisplay(t.location) || t.location : 'Trip';
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="w-full flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-availability-away/15 text-availability-away shrink-0">
              <Plane className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                {city}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-2.5 w-2.5" />
                {format(new Date(t.start_date + 'T00:00:00'), 'MMM d')} – {format(new Date(t.end_date + 'T00:00:00'), 'MMM d')}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
