import { useMemo, useState, useEffect } from 'react';
import { format, addDays, isToday, isSameDay } from 'date-fns';
import { Home, Plane, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LocationStatus } from '@/types/planner';
import { Link } from 'react-router-dom';

interface DayLocationData {
  date: Date;
  status: LocationStatus;
}

export function LocationTimeline() {
  const { session } = useAuth();
  const { getLocationStatusForDate, availability } = usePlannerStore();
  const [extendedAvailability, setExtendedAvailability] = useState<Map<string, LocationStatus>>(new Map());

  // Get 21 days (3 weeks) starting from today
  const days = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => addDays(new Date(), i));
  }, []);

  // Fetch extended availability data for days beyond what's loaded in the store
  useEffect(() => {
    async function fetchExtendedAvailability() {
      if (!session?.user) return;

      const dates = days.map(d => format(d, 'yyyy-MM-dd'));
      
      const { data } = await supabase
        .from('availability')
        .select('date, location_status')
        .eq('user_id', session.user.id)
        .in('date', dates);

      if (data) {
        const map = new Map<string, LocationStatus>();
        data.forEach(item => {
          map.set(item.date, (item.location_status as LocationStatus) || 'home');
        });
        setExtendedAvailability(map);
      }
    }

    fetchExtendedAvailability();
  }, [session?.user, days]);

  const getDayLocation = (date: Date): LocationStatus => {
    const dateStr = format(date, 'yyyy-MM-dd');
    // First check extended availability (freshly fetched)
    if (extendedAvailability.has(dateStr)) {
      return extendedAvailability.get(dateStr)!;
    }
    // Fallback to store data
    return getLocationStatusForDate(date);
  };

  // Group consecutive days by status for visual grouping
  const getWeekLabel = (weekIndex: number) => {
    if (weekIndex === 0) return 'This Week';
    if (weekIndex === 1) return 'Next Week';
    return 'Week 3';
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Location Status</h2>
        </div>
        <Link to="/availability">
          <span className="text-sm text-primary hover:underline cursor-pointer">Edit</span>
        </Link>
      </div>

      {/* Scrollable timeline */}
      <div className="overflow-x-auto -mx-4 px-4 md:-mx-6 md:px-6 pb-2">
        <div className="flex gap-1 min-w-max">
          {days.map((day, index) => {
            const status = getDayLocation(day);
            const isCurrentDay = isToday(day);
            const weekIndex = Math.floor(index / 7);
            const isFirstOfWeek = index % 7 === 0;

            return (
              <div key={day.toISOString()} className="flex flex-col items-center">
                {/* Week label */}
                {isFirstOfWeek && (
                  <div className="text-[10px] text-muted-foreground font-medium mb-1 w-full text-center">
                    {getWeekLabel(weekIndex)}
                  </div>
                )}
                {!isFirstOfWeek && index < 7 && <div className="h-[14px] mb-1" />}
                {!isFirstOfWeek && index >= 7 && index < 14 && <div className="h-[14px] mb-1" />}
                {!isFirstOfWeek && index >= 14 && <div className="h-[14px] mb-1" />}

                {/* Day box */}
                <div
                  className={cn(
                    "flex flex-col items-center justify-center w-10 h-14 rounded-lg transition-all",
                    isCurrentDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    status === 'home' 
                      ? "bg-primary/10 text-primary" 
                      : "bg-orange-500/10 text-orange-600"
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">
                    {format(day, 'EEE').slice(0, 2)}
                  </span>
                  <span className="text-sm font-bold">
                    {format(day, 'd')}
                  </span>
                  {status === 'home' ? (
                    <Home className="h-3 w-3 mt-0.5" />
                  ) : (
                    <Plane className="h-3 w-3 mt-0.5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10">
            <Home className="h-3 w-3 text-primary" />
          </div>
          <span>Home</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-500/10">
            <Plane className="h-3 w-3 text-orange-600" />
          </div>
          <span>Away</span>
        </div>
      </div>
    </div>
  );
}
