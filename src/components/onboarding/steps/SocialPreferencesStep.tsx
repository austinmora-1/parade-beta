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

const TIME_PREFS = [
  { id: 'morning', label: '🌅 Morning' },
  { id: 'afternoon', label: '☀️ Afternoon' },
  { id: 'evening', label: '🌙 Evening' },
  { id: 'late-night', label: '🦉 Late Night' },
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

export function SocialPreferencesStep({ data, updateData }: SocialPreferencesStepProps) {
  const [emailInput, setEmailInput] = useState('');

  const toggleDay = (dayId: string) => {
    const newDays = data.workDays.includes(dayId)
      ? data.workDays.filter(d => d !== dayId)
      : [...data.workDays, dayId];
    updateData({ workDays: newDays });
  };

  const toggleSocialDay = (dayId: string) => {
    const newDays = data.preferredSocialDays.includes(dayId)
      ? data.preferredSocialDays.filter(d => d !== dayId)
      : [...data.preferredSocialDays, dayId];
    updateData({ preferredSocialDays: newDays });
  };

  const toggleSocialTime = (timeId: string) => {
    const newTimes = data.preferredSocialTimes.includes(timeId)
      ? data.preferredSocialTimes.filter(t => t !== timeId)
      : [...data.preferredSocialTimes, timeId];
    updateData({ preferredSocialTimes: newTimes });
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

        {/* Preferred Social Days */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Preferred Social Days</Label>
          <div className="flex gap-2">
            {DAYS.map((day) => (
              <button
                key={day.id}
                onClick={() => toggleSocialDay(day.id)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                  data.preferredSocialDays.includes(day.id)
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preferred Social Times */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Preferred Times</Label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_PREFS.map((pref) => (
              <button
                key={pref.id}
                onClick={() => toggleSocialTime(pref.id)}
                className={cn(
                  "py-2.5 rounded-lg text-sm font-medium transition-all",
                  data.preferredSocialTimes.includes(pref.id)
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {pref.label}
              </button>
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
