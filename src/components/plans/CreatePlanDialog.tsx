import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Clock, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlannerStore } from '@/stores/plannerStore';
import { 
  ACTIVITY_CONFIG, 
  VIBE_CONFIG,
  TIME_SLOT_LABELS, 
  ActivityType, 
  VibeType,
  TimeSlot, 
  Plan,
  getActivitiesByVibe,
  getAllVibes
} from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';

interface PlaceSuggestion {
  place_id: string;
  display_name: string;
  main_text: string;
  secondary_text: string;
}

interface LocationSuggestion {
  display_name: string;
  place_id?: string;
}

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: Plan | null;
  defaultDate?: Date;
}

export function CreatePlanDialog({ open, onOpenChange, editPlan, defaultDate }: CreatePlanDialogProps) {
  const { addPlan, updatePlan, friends } = usePlannerStore();
  
  const [title, setTitle] = useState('');
  const [selectedVibe, setSelectedVibe] = useState<VibeType>('social');
  const [activity, setActivity] = useState<ActivityType | string>('drinks');
  const [date, setDate] = useState<Date>(new Date());
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('late-morning');
  const [duration, setDuration] = useState('60');
  const [locationName, setLocationName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Get activities for selected vibe
  const vibeActivities = getActivitiesByVibe(selectedVibe);

  // Search for locations using Google Places API via edge function
  const searchLocation = async (query: string) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { 
          query, 
          types: 'establishment' // Search for businesses, restaurants, etc.
        },
      });

      if (error) throw error;

      const suggestions: LocationSuggestion[] = (data.suggestions || []).map((s: PlaceSuggestion) => ({
        display_name: `${s.main_text}${s.secondary_text ? ` · ${s.secondary_text}` : ''}`,
        place_id: s.place_id,
      }));

      setLocationSuggestions(suggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching location:', error);
      setLocationSuggestions([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleLocationChange = (value: string) => {
    setLocationName(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchLocation(value);
    }, 300);
  };

  const selectLocation = (suggestion: LocationSuggestion) => {
    setLocationName(suggestion.display_name);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  // Sync form state when editPlan changes or dialog opens
  useEffect(() => {
    if (open && editPlan) {
      setTitle(editPlan.title);
      setActivity(editPlan.activity);
      // Set vibe based on activity
      const config = ACTIVITY_CONFIG[editPlan.activity as ActivityType];
      if (config) {
        setSelectedVibe(config.vibeType);
      }
      setDate(editPlan.date);
      setTimeSlot(editPlan.timeSlot);
      setDuration(editPlan.duration?.toString() || '60');
      setLocationName(editPlan.location?.name || '');
      setSelectedFriends(editPlan.participants.map((p) => p.id));
      setNotes(editPlan.notes || '');
    } else if (open && !editPlan) {
      // Reset for new plan
      setTitle('');
      setSelectedVibe('social');
      setActivity('drinks');
      setDate(defaultDate || new Date());
      setTimeSlot('late-morning');
      setDuration('60');
      setLocationName('');
      setSelectedFriends([]);
      setNotes('');
    }
  }, [open, editPlan, defaultDate]);

  // When vibe changes, select first activity in that vibe
  useEffect(() => {
    const activitiesInVibe = getActivitiesByVibe(selectedVibe);
    if (activitiesInVibe.length > 0 && !activitiesInVibe.includes(activity as ActivityType)) {
      setActivity(activitiesInVibe[0]);
    }
  }, [selectedVibe, activity]);

  const handleSubmit = () => {
    const planData = {
      title,
      activity,
      date,
      timeSlot,
      duration: parseInt(duration) || 60,
      location: locationName ? { id: crypto.randomUUID(), name: locationName, address: '' } : undefined,
      participants: friends.filter((f) => selectedFriends.includes(f.id)),
      notes,
    };

    if (editPlan) {
      updatePlan(editPlan.id, planData);
    } else {
      addPlan({
        ...planData,
      });
    }

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setSelectedVibe('social');
    setActivity('drinks');
    setDate(new Date());
    setTimeSlot('late-morning');
    setDuration('60');
    setLocationName('');
    setSelectedFriends([]);
    setNotes('');
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-lg">
            {editPlan ? 'Edit Plan' : 'New Plan'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs">What are you planning?</Label>
            <Input
              id="title"
              placeholder="e.g., Dinner at that new place"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Activity Type with Vibes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Activity</Label>
            
            {/* Vibe Tabs */}
            <Tabs 
              value={selectedVibe} 
              onValueChange={(v) => setSelectedVibe(v as VibeType)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-4 h-8">
                {getAllVibes().map((vibe) => (
                  <TabsTrigger key={vibe} value={vibe} className="gap-1 text-xs py-1 px-1">
                    <span>{VIBE_CONFIG[vibe].icon}</span>
                    <span className="hidden sm:inline">{VIBE_CONFIG[vibe].label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Activity Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
              {vibeActivities.map((type) => {
                const config = ACTIVITY_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActivity(type)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 transition-all",
                      activity === type
                        ? "border-primary bg-primary/10"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <ActivityIcon config={config} size={18} />
                    <span className="text-[8px] font-medium leading-tight text-center line-clamp-1">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date, Time & Duration - all in one row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9 text-xs px-2",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {date ? format(date, 'MMM d') : 'Date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
                    <SelectItem key={slot} value={slot} className="text-xs">
                      {TIME_SLOT_LABELS[slot].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-9 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30" className="text-xs">30m</SelectItem>
                  <SelectItem value="60" className="text-xs">1h</SelectItem>
                  <SelectItem value="90" className="text-xs">1.5h</SelectItem>
                  <SelectItem value="120" className="text-xs">2h</SelectItem>
                  <SelectItem value="180" className="text-xs">3h</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <Label htmlFor="location" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Location
            </Label>
            <div className="relative">
              <Input
                id="location"
                placeholder="Search for a place..."
                value={locationName}
                onChange={(e) => handleLocationChange(e.target.value)}
                onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="h-9 pr-8 text-sm"
              />
              {isSearchingLocation ? (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              )}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {locationSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectLocation(suggestion)}
                      className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                    >
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-1">{suggestion.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Friends - compact */}
          {friends.filter((f) => f.status === 'connected').length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Users className="h-3 w-3" />
                Invite Friends
              </Label>
              <div className="flex flex-wrap gap-1">
                {friends
                  .filter((f) => f.status === 'connected')
                  .map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => toggleFriend(friend.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                        selectedFriends.includes(friend.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {friend.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Notes - smaller */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={handleSubmit} disabled={!title}>
              {editPlan ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
