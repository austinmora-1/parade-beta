import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { Clock, Users, X, Plus, Mail, Sparkles } from 'lucide-react';

interface SocialPreferencesStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const DAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

const TIME_SLOTS = [
  { id: 'morning', label: '🌅 Morning', sublabel: '6am–12pm' },
  { id: 'afternoon', label: '☀️ Afternoon', sublabel: '12–5pm' },
  { id: 'evening', label: '🌙 Evening', sublabel: '5–10pm' },
  { id: 'late-night', label: '🦉 Late Night', sublabel: '10pm+' },
];

const INTEREST_OPTIONS = [
  '🍸 Drinks', '🍽️ Dinner', '☕ Coffee', '🎬 Movies',
  '🏃 Running', '🧘 Yoga', '🏋️ Gym', '🥾 Hiking',
  '🎮 Gaming', '🎵 Live Music', '🎨 Art', '📚 Book Club',
  '🏖️ Beach', '🎳 Bowling', '🎤 Karaoke', '🛹 Skating',
  '🍳 Brunch', '🎪 Events', '🐕 Dog Walks', '🧗 Climbing',
];

const formatTime = (decimalHour: number) => {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  if (minutes === 0) return `${displayHours}${period}`;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
};

/** Check if a day:time pair exists in the preferredSocialTimes array */
function hasDayTime(times: string[], day: string, time: string) {
  return times.includes(`${day}:${time}`);
}

/** Get the set of days that have any time selected */
function getSelectedDays(times: string[]): Set<string> {
  const days = new Set<string>();
  for (const entry of times) {
    const [day] = entry.split(':');
    if (day) days.add(day);
  }
  return days;
}

export function SocialPreferencesStep({ data, updateData }: SocialPreferencesStepProps) {
  const [emailInput, setEmailInput] = useState('');

  const selectedDays = getSelectedDays(data.preferredSocialTimes);

  const toggleDay = (dayId: string) => {
    const newDays = data.workDays.includes(dayId)
      ? data.workDays.filter(d => d !== dayId)
      : [...data.workDays, dayId];
    updateData({ workDays: newDays });
  };

  const toggleSocialDayTime = (day: string, time: string) => {
    const key = `${day}:${time}`;
    const newTimes = data.preferredSocialTimes.includes(key)
      ? data.preferredSocialTimes.filter(t => t !== key)
      : [...data.preferredSocialTimes, key];
    // Derive preferredSocialDays from the updated times
    const newDays = Array.from(getSelectedDays(newTimes));
    updateData({ preferredSocialTimes: newTimes, preferredSocialDays: newDays });
  };

  const toggleEntireDay = (day: string) => {
    const dayTimes = data.preferredSocialTimes.filter(t => t.startsWith(`${day}:`));
    if (dayTimes.length > 0) {
      // Remove all times for this day
      const newTimes = data.preferredSocialTimes.filter(t => !t.startsWith(`${day}:`));
      const newDays = Array.from(getSelectedDays(newTimes));
      updateData({ preferredSocialTimes: newTimes, preferredSocialDays: newDays });
    } else {
      // Add all times for this day
      const allDayTimes = TIME_SLOTS.map(s => `${day}:${s.id}`);
      const newTimes = [...data.preferredSocialTimes, ...allDayTimes];
      const newDays = Array.from(getSelectedDays(newTimes));
      updateData({ preferredSocialTimes: newTimes, preferredSocialDays: newDays });
    }
  };

  const toggleInterest = (interest: string) => {
    const newInterests = data.interests.includes(interest)
      ? data.interests.filter(i => i !== interest)
      : [...data.interests, interest];
    updateData({ interests: newInterests });
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !data.friendEmails.includes(email)) {
      updateData({ friendEmails: [...data.friendEmails, email] });
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    updateData({ friendEmails: data.friendEmails.filter(e => e !== email) });
  };

  const getTimesForDay = (day: string) => {
    return TIME_SLOTS.filter(slot => hasDayTime(data.preferredSocialTimes, day, slot.id));
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Social Preferences</h1>
        <p className="text-muted-foreground">Help us understand your social style.</p>
      </div>

      <div className="space-y-6">
        {/* Work Hours */}
        <div>
          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Typical Work Hours
          </Label>
          <div className="space-y-1 mb-3">
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                    data.workDays.includes(day.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{formatTime(data.workStartHour)}</span>
            <Slider
              value={[data.workStartHour, data.workEndHour]}
              onValueChange={([start, end]) => updateData({ workStartHour: start, workEndHour: end })}
              min={5}
              max={22}
              step={0.5}
              className="flex-1"
            />
            <span className="text-muted-foreground">{formatTime(data.workEndHour)}</span>
          </div>
        </div>

        {/* Social Cap */}
        <div>
          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Social Cap
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Max social activities per week: <span className="font-bold text-foreground">{data.socialCap || 'No limit'}</span>
          </p>
          <Slider
            value={[data.socialCap || 42]}
            onValueChange={([value]) => updateData({ socialCap: value >= 42 ? null : value })}
            min={1}
            max={42}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1</span>
            <span className="text-[10px] text-muted-foreground">No limit</span>
          </div>
        </div>

        {/* Preferred Social Days & Times (combined) */}
        <div>
          <Label className="text-sm font-medium mb-1 block">Preferred Social Times</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Tap a day to select all times, or pick specific time slots for each day.
          </p>

          {/* Day headers row */}
          <div className="flex gap-1 mb-2">
            {DAYS.map((day) => {
              const isActive = selectedDays.has(day.id);
              const dayTimeCount = getTimesForDay(day.id).length;
              const isFullDay = dayTimeCount === TIME_SLOTS.length;
              return (
                <button
                  key={day.id}
                  onClick={() => toggleEntireDay(day.id)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium transition-all relative",
                    isFullDay
                      ? "bg-accent text-accent-foreground ring-1 ring-accent"
                      : isActive
                        ? "bg-accent/50 text-accent-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {day.label}
                  {isActive && !isFullDay && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                      {dayTimeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time slot grid per day */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[auto_repeat(7,1fr)] bg-muted/30">
              <div className="p-1.5 text-[10px] font-medium text-muted-foreground" />
              {DAYS.map(day => (
                <div key={day.id} className="p-1.5 text-center text-[10px] font-medium text-muted-foreground">
                  {day.label}
                </div>
              ))}
            </div>

            {/* Time rows */}
            {TIME_SLOTS.map((slot, slotIdx) => (
              <div
                key={slot.id}
                className={cn(
                  "grid grid-cols-[auto_repeat(7,1fr)] items-center",
                  slotIdx < TIME_SLOTS.length - 1 && "border-b border-border/50"
                )}
              >
                <div className="px-2 py-2 min-w-[72px]">
                  <div className="text-[11px] font-medium leading-tight">{slot.label}</div>
                  <div className="text-[9px] text-muted-foreground leading-tight">{slot.sublabel}</div>
                </div>
                {DAYS.map(day => {
                  const isSelected = hasDayTime(data.preferredSocialTimes, day.id, slot.id);
                  return (
                    <div key={day.id} className="flex justify-center p-1">
                      <button
                        onClick={() => toggleSocialDayTime(day.id, slot.id)}
                        className={cn(
                          "h-7 w-7 rounded-md transition-all flex items-center justify-center text-xs",
                          isSelected
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "bg-muted/30 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                        )}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Interests & Activities</Label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  data.interests.includes(interest)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Close Friends / Invite */}
        <div>
          <Label className="text-sm font-medium mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" /> Invite Close Friends
          </Label>
          <div className="flex gap-1.5">
            <Input
              type="email"
              placeholder="friend@email.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
              className="flex-1 h-9 text-sm"
            />
            <Button onClick={handleAddEmail} size="sm" variant="outline" className="h-9 w-9 p-0">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {data.friendEmails.length > 0 && (
            <div className="space-y-1 mt-2">
              {data.friendEmails.map((email) => (
                <div key={email} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{email}</span>
                  </div>
                  <button onClick={() => handleRemoveEmail(email)} className="rounded p-0.5 hover:bg-muted transition-colors">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
