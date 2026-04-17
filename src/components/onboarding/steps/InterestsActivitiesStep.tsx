import { useState, useRef, useEffect, useMemo } from 'react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { ChevronDown, Check, X, Plus, Search } from 'lucide-react';
import { ACTIVITY_CONFIG, VIBE_CONFIG, type VibeType } from '@/types/planner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface InterestsActivitiesStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const SOCIAL_GOALS = [
  { id: 'stay_connected', label: 'Stay connected with close friends' },
  { id: 'try_new_things', label: 'Try new activities & experiences' },
  { id: 'be_more_social', label: 'Be more intentional about socializing' },
  { id: 'less_flaking', label: 'Follow through on plans more' },
  { id: 'work_life_balance', label: 'Better work-life balance' },
  { id: 'meet_new_people', label: 'Meet new people' },
];

const VIBE_ORDER: VibeType[] = ['social', 'athletic', 'chill', 'productive'];

const VIBE_CHIP_STYLES: Record<VibeType, string> = {
  social: 'bg-pink-500/15 text-pink-400 ring-pink-500/30',
  athletic: 'bg-green-500/15 text-green-400 ring-green-500/30',
  chill: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  productive: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  custom: 'bg-primary/15 text-primary ring-primary/30',
};

const EMOJI_PALETTE = [
  '✨', '🎉', '🎯', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼',
  '🍕', '🍔', '🌮', '🍣', '🍜', '🍰', '🍷', '🍺', '🥂', '☕',
  '⚽', '🏀', '🎾', '🏈', '⚾', '🏐', '🏓', '🥊', '🏋️', '🚴',
  '🏊', '🏄', '⛷️', '🧗', '🤸', '🧘', '🏃', '🚶', '🧖', '💆',
  '🌳', '🌊', '🏔️', '🏖️', '🌅', '🌙', '⭐', '🔥', '💎', '🎁',
  '📚', '🎮', '🎲', '🧩', '🎸', '🎹', '🥁', '🎺', '🎻', '🪩',
  '🐶', '🐱', '🦋', '🌸', '🌻', '🌺', '🍀', '🦄', '🐝', '🐢',
];

// Build a label → activity map (for display when stored as "🍸 Drinks" strings).
const ALL_ACTIVITIES = Object.entries(ACTIVITY_CONFIG)
  .filter(([id]) => id !== 'custom')
  .map(([id, config]) => ({
    id,
    label: config.label,
    icon: config.icon,
    vibeType: config.vibeType,
    display: `${config.icon} ${config.label}`,
  }));

export function InterestsActivitiesStep({ data, updateData }: InterestsActivitiesStepProps) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const goalsRef = useRef<HTMLDivElement>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✨');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (goalsRef.current && !goalsRef.current.contains(e.target as Node)) {
        setGoalsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const interestSet = useMemo(() => new Set(data.interests), [data.interests]);

  const toggleActivity = (display: string) => {
    if (interestSet.has(display)) {
      updateData({ interests: data.interests.filter(i => i !== display) });
    } else {
      updateData({ interests: [...data.interests, display] });
    }
  };

  const removeInterest = (display: string) => {
    updateData({ interests: data.interests.filter(i => i !== display) });
  };

  const addCustom = () => {
    const trimmed = customLabel.trim();
    if (!trimmed) return;
    const display = `${customEmoji} ${trimmed}`;
    if (!interestSet.has(display)) {
      updateData({ interests: [...data.interests, display] });
    }
    setCustomLabel('');
    setCustomEmoji('✨');
    setCustomOpen(false);
  };

  const toggleGoal = (goalId: string) => {
    const current = data.socialGoals || [];
    const updated = current.includes(goalId)
      ? current.filter(g => g !== goalId)
      : [...current, goalId];
    updateData({ socialGoals: updated });
  };

  // Lookup vibe type for stored interest strings (for chip color).
  const getVibeForDisplay = (display: string): VibeType => {
    const match = ALL_ACTIVITIES.find(a => a.display === display);
    return match?.vibeType ?? 'custom';
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Social Goals & Interests</h1>
        <p className="text-muted-foreground">
          Tell us what you want out of your social life, and let us help you make it happen.
        </p>
      </div>

      {/* Social Goals Dropdown */}
      <div className="mb-6" ref={goalsRef}>
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <span>🎯</span> Social Goals
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          What are you hoping to get out of Parade?
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setGoalsOpen(prev => !prev)}
            className="w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
          >
            <span className={cn(
              "truncate",
              (data.socialGoals || []).length === 0 && "text-muted-foreground"
            )}>
              {(data.socialGoals || []).length === 0
                ? 'Select your goals...'
                : `${(data.socialGoals || []).length} goal${(data.socialGoals || []).length !== 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", goalsOpen && "rotate-180")} />
          </button>
          {goalsOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              <div className="max-h-56 overflow-y-auto py-1">
                {SOCIAL_GOALS.map((goal) => {
                  const selected = (data.socialGoals || []).includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => toggleGoal(goal.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}>
                        {selected && <Check className="h-3 w-3" />}
                      </div>
                      <span>{goal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activities */}
      <div>
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <span>✨</span> Activities & Interests
          {data.interests.length > 0 && (
            <span className="ml-auto text-xs text-primary font-medium">
              {data.interests.length} selected
            </span>
          )}
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          Search and select activities you enjoy.
        </p>

        {/* Searchable activity dropdown */}
        <Popover open={activityOpen} onOpenChange={setActivityOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4" />
                Search activities...
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", activityOpen && "rotate-180")} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            align="start"
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="Type to search..." />
              <CommandList className="max-h-72">
                <CommandEmpty>No activities found.</CommandEmpty>
                {VIBE_ORDER.map((vibe) => {
                  const items = ALL_ACTIVITIES.filter(a => a.vibeType === vibe);
                  if (items.length === 0) return null;
                  return (
                    <CommandGroup key={vibe} heading={VIBE_CONFIG[vibe].label}>
                      {items.map((activity) => {
                        const selected = interestSet.has(activity.display);
                        return (
                          <CommandItem
                            key={activity.id}
                            value={`${activity.label} ${activity.id}`}
                            onSelect={() => toggleActivity(activity.display)}
                            className="flex items-center gap-2"
                          >
                            <span className="text-base">{activity.icon}</span>
                            <span className="flex-1">{activity.label}</span>
                            {selected && <Check className="h-4 w-4 text-primary" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Add custom activity */}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a custom activity
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Pick an emoji</label>
                <div className="mt-1.5 grid grid-cols-10 gap-1 max-h-32 overflow-y-auto rounded-md border border-border bg-muted/20 p-1.5">
                  {EMOJI_PALETTE.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCustomEmoji(emoji)}
                      className={cn(
                        "h-7 w-7 flex items-center justify-center rounded transition-all text-base",
                        customEmoji === emoji
                          ? "bg-primary/20 ring-1 ring-primary scale-110"
                          : "hover:bg-muted"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Activity name</label>
                <div className="mt-1.5 flex gap-2">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-input bg-muted/20 text-lg shrink-0">
                    {customEmoji}
                  </div>
                  <Input
                    autoFocus
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Pickleball"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={addCustom}
                disabled={!customLabel.trim()}
                className="w-full"
                size="sm"
              >
                Add activity
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Selected chips */}
        {data.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.interests.map((display) => {
              const vibe = getVibeForDisplay(display);
              return (
                <button
                  key={display}
                  type="button"
                  onClick={() => removeInterest(display)}
                  className={cn(
                    "group inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 transition-all hover:opacity-80",
                    VIBE_CHIP_STYLES[vibe]
                  )}
                >
                  <span>{display}</span>
                  <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
