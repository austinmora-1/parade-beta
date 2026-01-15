import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Clock, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { usePlannerStore } from '@/stores/plannerStore';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, ActivityType, TimeSlot, Plan } from '@/types/planner';
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
}

export function CreatePlanDialog({ open, onOpenChange, editPlan }: CreatePlanDialogProps) {
  const { addPlan, updatePlan, friends } = usePlannerStore();
  
  const [title, setTitle] = useState('');
  const [activity, setActivity] = useState<ActivityType>('misc');
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

  // Search for locations using Google Places API via edge function
  const searchLocation = async (query: string) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query },
      });

      if (error) throw error;

      const suggestions: LocationSuggestion[] = (data.suggestions || []).map((s: PlaceSuggestion) => ({
        display_name: s.display_name,
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
      setDate(editPlan.date);
      setTimeSlot(editPlan.timeSlot);
      setDuration(editPlan.duration?.toString() || '60');
      setLocationName(editPlan.location?.name || '');
      setSelectedFriends(editPlan.participants.map((p) => p.id));
      setNotes(editPlan.notes || '');
    } else if (open && !editPlan) {
      // Reset for new plan
      setTitle('');
      setActivity('misc');
      setDate(new Date());
      setTimeSlot('late-morning');
      setDuration('60');
      setLocationName('');
      setSelectedFriends([]);
      setNotes('');
    }
  }, [open, editPlan]);

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
    setActivity('misc');
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editPlan ? 'Edit Plan' : 'Create New Plan'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">What are you planning?</Label>
            <Input
              id="title"
              placeholder="e.g., Dinner at that new place"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Activity Type */}
          <div className="space-y-2">
            <Label>Activity Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((type) => {
                const config = ACTIVITY_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActivity(type)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 transition-all",
                      activity === type
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : 'Pick a date'}
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

            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Select value={timeSlot} onValueChange={(v) => setTimeSlot(v as TimeSlot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIME_SLOT_LABELS) as TimeSlot[]).map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {TIME_SLOT_LABELS[slot].label} ({TIME_SLOT_LABELS[slot].time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </Label>
            <div className="relative">
              <div className="relative">
                <Input
                  id="location"
                  placeholder="Search for a place..."
                  value={locationName}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pr-8"
                />
                {isSearchingLocation ? (
                  <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : (
                  <Search className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              {showSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                  {locationSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectLocation(suggestion)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{suggestion.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Friends */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Invite Friends
            </Label>
            <div className="flex flex-wrap gap-2">
              {friends
                .filter((f) => f.status === 'connected')
                .map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all",
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={!title}>
              {editPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
