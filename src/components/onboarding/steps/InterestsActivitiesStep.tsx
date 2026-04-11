import { useState } from 'react';
import { OnboardingData } from '../OnboardingWizard';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface InterestsActivitiesStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const SOCIAL_GOALS = [
  { id: 'stay_connected', emoji: '💛', label: 'Stay connected with close friends' },
  { id: 'meet_new_people', emoji: '👋', label: 'Meet new people' },
  { id: 'try_new_things', emoji: '✨', label: 'Try new activities & experiences' },
  { id: 'be_more_social', emoji: '🎯', label: 'Be more intentional about socializing' },
  { id: 'less_flaking', emoji: '📅', label: 'Follow through on plans more' },
  { id: 'work_life_balance', emoji: '⚖️', label: 'Better work-life balance' },
  { id: 'explore_city', emoji: '🏙️', label: 'Explore my city more' },
  { id: 'deepen_friendships', emoji: '🤝', label: 'Deepen existing friendships' },
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
  const [expandedVibes, setExpandedVibes] = useState<Set<string>>(
    new Set(VIBE_SECTIONS.map(v => v.vibe))
  );

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
        <h1 className="font-display text-2xl font-bold mb-2">Interests & Activities</h1>
        <p className="text-muted-foreground">
          Pick what you love to do — we'll use these to suggest plans.
        </p>
        {data.interests.length > 0 && (
          <p className="text-xs text-primary mt-1 font-medium">
            {data.interests.length} selected
          </p>
        )}
      </div>

      {/* Social Goals Section */}
      <div className="mb-6">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <span>🎯</span> Social Goals
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          What are you hoping to get out of Parade?
        </p>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => toggleGoal(goal.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                (data.socialGoals || []).includes(goal.id)
                  ? "bg-primary text-primary-foreground"
                  : "ring-1 ring-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
              )}
            >
              {goal.emoji} {goal.label}
            </button>
          ))}
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
