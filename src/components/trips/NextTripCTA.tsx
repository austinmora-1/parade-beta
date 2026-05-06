import { useMemo } from 'react';
import { format, startOfWeek, differenceInWeeks, isAfter, startOfDay } from 'date-fns';
import { Plane, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { useUserTrips } from '@/hooks/useUserTrips';
import { formatCityForDisplay } from '@/lib/formatCity';

interface NextTripCTAProps {
  onJumpToWeek: (weekOffset: number, tripId: string) => void;
}

export function NextTripCTA({ onJumpToWeek }: NextTripCTAProps) {
  const { trips, loading } = useUserTrips();

  const nextTrip = useMemo(() => {
    const today = startOfDay(new Date());
    return trips
      .slice()
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .find(t => !isAfter(today, new Date(t.end_date + 'T00:00:00'))) || null;
  }, [trips]);

  if (loading || !nextTrip) return null;

  const start = new Date(nextTrip.start_date + 'T00:00:00');
  const end = new Date(nextTrip.end_date + 'T00:00:00');
  const isOngoing = !isAfter(startOfDay(start), startOfDay(new Date()));
  const city = nextTrip.location ? (formatCityForDisplay(nextTrip.location) || nextTrip.location) : 'TBC';

  const handleClick = () => {
    const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const tripWeekStart = startOfWeek(start, { weekStartsOn: 1 });
    const offset = differenceInWeeks(tripWeekStart, todayWeekStart);
    onJumpToWeek(offset, nextTrip.id);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-2xl border border-border bg-card p-3 shadow-soft text-left transition-all hover:border-primary/40 hover:bg-primary/5 group"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-availability-away/15 text-availability-away shrink-0">
          <Plane className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isOngoing ? 'Current trip' : 'Next trip'}
            </span>
            {isOngoing && (
              <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                NOW
              </span>
            )}
          </div>
          <p className="font-display text-base font-bold truncate">
            {nextTrip.name || city}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 min-w-0">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{city}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {format(start, 'MMM d')} – {format(end, 'MMM d')}
            </span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
      </div>
    </button>
  );
}
