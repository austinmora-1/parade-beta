import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, MapPin, Users, Clock } from 'lucide-react';
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
            <Label htmlFor="title">Plan Title</Label>
            <Input
              id="title"
              placeholder="What are you planning?"
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
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all",
                      activity === type
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <span className="text-xs font-medium">{config.label}</span>
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
              Duration (minutes)
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
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
            <Input
              id="location"
              placeholder="Enter a location..."
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
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
