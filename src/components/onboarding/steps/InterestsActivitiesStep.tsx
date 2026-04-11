import { useState, useRef, useEffect } from 'react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

interface InterestsActivitiesStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const SOCIAL_GOALS = [
  { id: 'stay_connected', label: 'Stay connected with close friends' },
  { id: 'meet_new_people', label: 'Meet new people' },
  { id: 'try_new_things', label: 'Try new activities & experiences' },
  { id: 'be_more_social', label: 'Be more intentional about socializing' },
  { id: 'less_flaking', label: 'Follow through on plans more' },
  { id: 'work_life_balance', label: 'Better work-life balance' },
];

const VIBE_SECTIONS = [
  {
    vibe: 'Social',
    emoji: '🎉',
    color: 'bg-pink-500/10 text-pink-400 ring-pink-500/30',
    activeColor: 'bg-pink-500 text-white',
    activities: [
      '🍸 Drinks', '🍽️ Dinner', '☕ Coffee', '🍳 Brunch',
      '🎤 Karaoke', '💃 Dancing', '🍕 Cooking', '🍷 Wine Tasting',
      '🎭 Theater', '🎪 Events', '🛍️ Shopping',
      '🎵 Live Music',
    ],
  },
  {
    vibe: 'Chill',
    emoji: '😌',
    color: 'bg-blue-500/10 text-blue-400 ring-blue-500/30',
    activeColor: 'bg-blue-500 text-white',
    activities: [
      '🎬 Movies', '📺 TV Nights', '📚 Book Club',
      '🎮 Gaming', '🧩 Puzzles', '🧖 Spa Day', '🏖️ Beach',
      '🐕 Dog Walks', '🪴 Gardening', '📸 Photography', '🎸 Jam Sessions',
      '🎲 Board Games',
    ],
  },
  {
    vibe: 'Athletic',
    emoji: '💪',
    color: 'bg-green-500/10 text-green-400 ring-green-500/30',
    activeColor: 'bg-green-500 text-white',
    activities: [
      '🏃 Running', '🧘 Yoga', '🏋️ Gym', '🥾 Hiking',
      '🧗 Climbing', '🚴 Cycling', '🏊 Swimming', '🎾 Tennis',
      '⚽ Soccer', '🏀 Basketball', '🏓 Ping Pong', '🛹 Skating',
      '🎳 Bowling', '🏕️ Camping',
    ],
  },
  {
    vibe: 'Productive',
    emoji: '🚀',
    color: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
    activeColor: 'bg-amber-500 text-white',
    activities: [
      '🎨 Art', '✈️ Travel', '📖 Studying', '💻 Coworking',
      '🎯 Side Projects', '📝 Journaling', '🧠 Brainstorming', '📐 Design',
    ],
  },
];

export function InterestsActivitiesStep({ data, updateData }: InterestsActivitiesStepProps) {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const goalsRef = useRef<HTMLDivElement>(null);
  const [expandedVibes, setExpandedVibes] = useState<Set<string>>(
    new Set(VIBE_SECTIONS.map(v => v.vibe))
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (goalsRef.current && !goalsRef.current.contains(e.target as Node)) {
        setGoalsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleInterest = (interest: string) => {
    const newInterests = data.interests.includes(interest)
      ? data.interests.filter(i => i !== interest)
      : [...data.interests, interest];
    updateData({ interests: newInterests });
  };

  const toggleGoal = (goalId: string) => {
    const current = data.socialGoals || [];
    const updated = current.includes(goalId)
      ? current.filter(g => g !== goalId)
      : [...current, goalId];
    updateData({ socialGoals: updated });
  };

  const toggleVibeExpand = (vibe: string) => {
    setExpandedVibes(prev => {
      const next = new Set(prev);
      if (next.has(vibe)) next.delete(vibe);
      else next.add(vibe);
      return next;
    });
  };

  const selectAllInVibe = (activities: string[]) => {
    const allSelected = activities.every(a => data.interests.includes(a));
    if (allSelected) {
      updateData({ interests: data.interests.filter(i => !activities.includes(i)) });
    } else {
      const toAdd = activities.filter(a => !data.interests.includes(a));
      updateData({ interests: [...data.interests, ...toAdd] });
    }
  };

  const getVibeCount = (activities: string[]) =>
    activities.filter(a => data.interests.includes(a)).length;

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Social Goals & Interests</h1>
        <p className="text-muted-foreground">
          Tell us what you want out of your social life, and let us help you make it happen.
        </p>
        {data.interests.length > 0 && (
          <p className="text-xs text-primary mt-1 font-medium">
            {data.interests.length} selected
          </p>
        )}
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
      <div className="space-y-3">
        {VIBE_SECTIONS.map((section) => {
          const isExpanded = expandedVibes.has(section.vibe);
          const count = getVibeCount(section.activities);
          const allSelected = section.activities.every(a => data.interests.includes(a));

          return (
            <div key={section.vibe} className="rounded-xl border border-border overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleVibeExpand(section.vibe)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{section.emoji}</span>
                  <span className="font-semibold text-sm">{section.vibe}</span>
                  {count > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInVibe(section.activities);
                    }}
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full transition-all",
                      allSelected
                        ? "bg-primary/20 text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Activities grid */}
              {isExpanded && (
                <div className="px-3 py-3 flex flex-wrap gap-2">
                  {section.activities.map((activity) => (
                    <button
                      key={activity}
                      onClick={() => toggleInterest(activity)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                        data.interests.includes(activity)
                          ? section.activeColor
                          : cn("ring-1", section.color, "hover:opacity-80")
                      )}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
