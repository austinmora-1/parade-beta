import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isAfter, isBefore } from 'date-fns';
import { Plane, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserTrip } from '@/hooks/useUserTrips';

interface TripWeekBannerProps {
  trips: UserTrip[];
  weekStart: Date;
  weekEnd: Date; // inclusive
}

/**
 * Slim multi-day trip banners shown above the week's day rows.
 * Trips that overlap the visible week are shown as a single horizontal
 * strip — never per-slot — to avoid cluttering the daily plan view.
 *
 * Visual: low-alpha parade-green tinted strip; chevrons indicate the trip
 * extends into prior/next weeks.
 */
export function TripWeekBanner({ trips, weekStart, weekEnd }: TripWeekBannerProps) {
  const navigate = useNavigate();

  const visible = useMemo(() => {
    return trips
      .map((t) => {
        const start = new Date(t.start_date + 'T00:00:00');
        const end = new Date(t.end_date + 'T00:00:00');
        // Overlap test
        if (isAfter(start, weekEnd) || isBefore(end, weekStart)) return null;
        return {
          ...t,
          _start: start,
          _end: end,
          _continuesLeft: isBefore(start, weekStart),
          _continuesRight: isAfter(end, weekEnd),
        };
      })
      .filter(Boolean) as Array<UserTrip & {
        _start: Date; _end: Date; _continuesLeft: boolean; _continuesRight: boolean;
      }>;
  }, [trips, weekStart, weekEnd]);

  if (visible.length === 0) return null;

  const cap = 2;
  const shown = visible.slice(0, cap);
  const overflow = visible.length - shown.length;

  return (
    <div className="space-y-1 px-3">
      {shown.map((trip) => {
        const sameMonth = trip._start.getMonth() === trip._end.getMonth();
        const range = sameMonth
          ? `${format(trip._start, 'MMM d')} – ${format(trip._end, 'd')}`
          : `${format(trip._start, 'MMM d')} – ${format(trip._end, 'MMM d')}`;
        const title = trip.name || trip.location || 'Trip';
        return (
          <button
            key={trip.id}
            onClick={() => navigate(`/trip/${trip.id}`)}
            className={cn(
              'group flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-left transition-colors hover:bg-primary/15'
            )}
          >
            {trip._continuesLeft && (
              <ChevronLeft className="h-3 w-3 shrink-0 text-primary/60" />
            )}
            <Plane className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs font-semibold text-primary">{title}</span>
            <span className="truncate text-[11px] font-medium text-primary/70">· {range}</span>
            {trip._continuesRight && (
              <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-primary/60" />
            )}
          </button>
        );
      })}
      {overflow > 0 && (
        <p className="px-1 text-[10px] font-medium text-muted-foreground">
          +{overflow} more trip{overflow > 1 ? 's' : ''} this week
        </p>
      )}
    </div>
  );
}
