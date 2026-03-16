import { useMemo, useState, useEffect, useCallback } from 'react';
import { format, addDays, isToday as isDateToday, differenceInDays, getMonth } from 'date-fns';
import { Home, Plane, MapPin, Plus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LocationStatus } from '@/types/planner';
import { Button } from '@/components/ui/button';
import { AddTripDialog, TripData } from './AddTripDialog';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Trip {
  startDate: Date;
  endDate: Date;
  startIndex: number;
  endIndex: number;
  location?: string;
}

export function LocationTimeline() {
  const { session } = useAuth();
  const { getLocationStatusForDate } = usePlannerStore();
  const [extendedAvailability, setExtendedAvailability] = useState<Map<string, { status: LocationStatus; location?: string }>>(new Map());
  const [addTripDialogOpen, setAddTripDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingDate, setUpdatingDate] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<string | null>(null);

  // Get 31 days (next month) starting from today
  const days = useMemo(() => {
    return Array.from({ length: 31 }, (_, i) => addDays(new Date(), i));
  }, []);

  // Fetch extended availability data for days beyond what's loaded in the store
  const fetchExtendedAvailability = useCallback(async () => {
    if (!session?.user) return;

    const dates = days.map(d => format(d, 'yyyy-MM-dd'));
    
    const { data } = await supabase
      .from('availability')
      .select('date, location_status, trip_location')
      .eq('user_id', session.user.id)
      .in('date', dates);

    if (data) {
      const map = new Map<string, { status: LocationStatus; location?: string }>();
      data.forEach(item => {
        map.set(item.date, {
          status: (item.location_status as LocationStatus) || 'home',
          location: item.trip_location || undefined,
        });
      });
      setExtendedAvailability(map);
    }
  }, [session?.user, days]);

  // Fetch home address from profile
  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from('profiles')
      .select('home_address')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        setHomeAddress(data?.home_address || null);
      });
  }, [session?.user]);

  useEffect(() => {
    fetchExtendedAvailability();
  }, [fetchExtendedAvailability, refreshKey]);

  const handleTripAdded = () => {
    setRefreshKey(prev => prev + 1);
    setEditingTrip(null);
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip({
      startDate: trip.startDate,
      endDate: trip.endDate,
      location: trip.location,
    });
    setAddTripDialogOpen(true);
  };

  const handleOpenAddTrip = () => {
    setEditingTrip(null);
    setAddTripDialogOpen(true);
  };

  // Check if a trip location matches the user's home address
  const isHomeLocation = useCallback((tripLocation?: string): boolean => {
    if (!tripLocation || !homeAddress) return false;
    const normTrip = tripLocation.toLowerCase().trim();
    const normHome = homeAddress.toLowerCase().trim();
    // Direct substring match
    if (normHome.includes(normTrip) || normTrip.includes(normHome)) return true;
    // Extract city portion (before comma) for comparison
    const tripCity = normTrip.split(',')[0].trim().replace(/\s*(city|town|village)$/i, '').trim();
    const homeCity = normHome.split(',')[0].trim().replace(/\s*(city|town|village)$/i, '').trim();
    if (tripCity && homeCity && (tripCity.includes(homeCity) || homeCity.includes(tripCity))) return true;
    return false;
  }, [homeAddress]);

  const getDayLocation = (date: Date): LocationStatus => {
    const dateStr = format(date, 'yyyy-MM-dd');
    // First check extended availability (freshly fetched)
    if (extendedAvailability.has(dateStr)) {
      const entry = extendedAvailability.get(dateStr)!;
      // If marked away but trip location matches home, treat as home
      if (entry.status === 'away' && isHomeLocation(entry.location)) {
        return 'home';
      }
      return entry.status;
    }
    // Fallback to store data
    return getLocationStatusForDate(date);
  };

  const getDayTripLocation = (date: Date): string | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (extendedAvailability.has(dateStr)) {
      return extendedAvailability.get(dateStr)!.location;
    }
    return undefined;
  };

  // Toggle location status for a specific day
  const toggleDayStatus = async (date: Date) => {
    if (!session?.user) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const currentStatus = getDayLocation(date);
    const newStatus: LocationStatus = currentStatus === 'home' ? 'away' : 'home';
    
    setUpdatingDate(dateStr);
    
    // Optimistically update UI
    const existingData = extendedAvailability.get(dateStr);
    setExtendedAvailability(prev => {
      const newMap = new Map(prev);
      newMap.set(dateStr, { 
        status: newStatus, 
        location: newStatus === 'home' ? undefined : existingData?.location 
      });
      return newMap;
    });

    // If toggling today, also update the planner store's global locationStatus
    if (isDateToday(date)) {
      usePlannerStore.setState({ locationStatus: newStatus });
    }

    try {
      const { error } = await supabase
        .from('availability')
        .upsert({
          user_id: session.user.id,
          date: dateStr,
          location_status: newStatus,
          trip_location: newStatus === 'home' ? null : (existingData?.location || null),
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      
      toast.success(`${format(date, 'MMM d')}: ${newStatus === 'home' ? 'Home' : 'Away'}`);
    } catch (error) {
      // Revert on error
      setExtendedAvailability(prev => {
        const newMap = new Map(prev);
        newMap.set(dateStr, { status: currentStatus, location: existingData?.location });
        return newMap;
      });
      if (isDateToday(date)) {
        usePlannerStore.setState({ locationStatus: currentStatus });
      }
      toast.error('Failed to update status');
    } finally {
      setUpdatingDate(null);
    }
  };

  // Detect consecutive away days as trips (with same location)
  const trips = useMemo(() => {
    const tripsList: Trip[] = [];
    let tripStart: number | null = null;
    let currentTripLocation: string | undefined = undefined;

    days.forEach((day, index) => {
      const status = getDayLocation(day);
      const location = getDayTripLocation(day);
      
      if (status === 'away') {
        // Check if this is a new trip or continuation of existing
        if (tripStart === null) {
          tripStart = index;
          currentTripLocation = location;
        } else if (location !== currentTripLocation) {
          // Different location means end current trip and start new one
          const tripLength = index - tripStart;
          if (tripLength >= 2) {
            tripsList.push({
              startDate: days[tripStart],
              endDate: days[index - 1],
              startIndex: tripStart,
              endIndex: index - 1,
              location: currentTripLocation,
            });
          }
          tripStart = index;
          currentTripLocation = location;
        }
      } else {
        if (tripStart !== null) {
          // End of a trip - only count if 2+ days
          const tripLength = index - tripStart;
          if (tripLength >= 2) {
            tripsList.push({
              startDate: days[tripStart],
              endDate: days[index - 1],
              startIndex: tripStart,
              endIndex: index - 1,
              location: currentTripLocation,
            });
          }
          tripStart = null;
          currentTripLocation = undefined;
        }
      }
    });

    // Check if trip extends to end
    if (tripStart !== null) {
      const tripLength = days.length - tripStart;
      if (tripLength >= 2) {
        tripsList.push({
          startDate: days[tripStart],
          endDate: days[days.length - 1],
          startIndex: tripStart,
          endIndex: days.length - 1,
          location: currentTripLocation,
        });
      }
    }

    return tripsList;
  }, [days, extendedAvailability]);

  // Check if a day is part of a trip
  const getTripForDay = (index: number): Trip | undefined => {
    return trips.find(trip => index >= trip.startIndex && index <= trip.endIndex);
  };

  const formatTripDuration = (trip: Trip) => {
    const nights = differenceInDays(trip.endDate, trip.startDate);
    return `${nights} night${nights > 1 ? 's' : ''}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Status</h2>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="p-1 -m-1 rounded-full hover:bg-muted/50 transition-colors">
              <Info className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-auto text-sm p-2">
            View and update your status for the next month
          </PopoverContent>
        </Popover>
      </div>

      {/* Trip summaries - clickable to edit */}
      {trips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {trips.map((trip, idx) => (
            <button
              key={idx}
              onClick={() => handleEditTrip(trip)}
              className="inline-flex items-center gap-1.5 rounded-full bg-availability-away/10 px-2.5 py-1 text-xs hover:bg-availability-away/20 transition-colors cursor-pointer"
            >
              <Plane className="h-3.5 w-3.5 text-availability-away-foreground" />
              {trip.location && (
                <span className="font-semibold text-availability-away-foreground">{trip.location}</span>
              )}
              <span className={cn("font-medium", trip.location ? "text-orange-600" : "text-orange-700")}>
                {format(trip.startDate, 'MMM d')} – {format(trip.endDate, 'MMM d')}
              </span>
              <span className="text-orange-600/70">
                ({formatTripDuration(trip)})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Scrollable timeline */}
      <div className="overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5 pb-1">
        <div className="flex gap-1 min-w-max">
          {days.map((day, index) => {
            const status = getDayLocation(day);
            const isCurrentDay = isDateToday(day);
            const trip = getTripForDay(index);
            const isFirstOfTrip = trip && trip.startIndex === index;
            const isLastOfTrip = trip && trip.endIndex === index;
            const dateStr = format(day, 'yyyy-MM-dd');
            const isUpdating = updatingDate === dateStr;
            
            // Check if this is the first day of a new month
            const isFirstOfMonth = index === 0 || getMonth(day) !== getMonth(days[index - 1]);

            return (
              <div key={day.toISOString()} className="flex flex-col items-center relative">
                {/* Month label */}
                {isFirstOfMonth ? (
                  <div className="text-[10px] text-primary font-semibold mb-1 w-full text-center">
                    {format(day, 'MMM')}
                  </div>
                ) : (
                  <div className="h-[14px] mb-1" />
                )}

                {/* Trip connector bar */}
                {trip && (
                  <div 
                    className={cn(
                      "absolute top-[18px] h-1 bg-orange-400/50",
                      isFirstOfTrip ? "left-1/2 right-0 rounded-l-full" : "left-0",
                      isLastOfTrip ? "right-1/2 left-0 rounded-r-full" : "right-0",
                      !isFirstOfTrip && !isLastOfTrip && "left-0 right-0"
                    )}
                  />
                )}

                {/* Day box - now clickable */}
                <button
                  onClick={() => toggleDayStatus(day)}
                  disabled={isUpdating}
                  className={cn(
                    "flex flex-col items-center justify-center w-10 h-14 rounded-lg transition-all relative z-10",
                    "cursor-pointer hover:scale-105 hover:shadow-md active:scale-95",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isCurrentDay && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    status === 'home' 
                      ? "bg-primary/10 text-primary hover:bg-primary/20" 
                      : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
                    trip && "bg-orange-500/20 hover:bg-orange-500/30",
                    isUpdating && "opacity-50 cursor-wait"
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
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend and Add Trip button */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
          {trips.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1 w-5 rounded-full bg-orange-400/50" />
              <span>Trip</span>
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleOpenAddTrip}
          className="gap-1 h-7 px-2.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add trip
        </Button>
      </div>

      <AddTripDialog 
        open={addTripDialogOpen} 
        onOpenChange={setAddTripDialogOpen}
        onTripAdded={handleTripAdded}
        editingTrip={editingTrip}
      />
    </div>
  );
}
