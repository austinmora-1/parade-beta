import { useState } from 'react';
import { useWeeklyIntentions } from '@/hooks/useWeeklyIntentions';
import { WeeklyIntentionsSheet } from './WeeklyIntentionsSheet';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENERGY_EMOJI: Record<string, string> = { low: '🌙', medium: '☀️', high: '🔥' };

export function WeeklyIntentionsSummary() {
  const { intention, loading, upsertIntention, weekStart } = useWeeklyIntentions();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading) return null;

  // Show prompt if no intention set
  if (!intention) {
    return (
      <>
        <button
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <CalendarHeart className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Set your weekly intentions</p>
            <p className="text-xs text-muted-foreground">Plan your social energy for the week</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        <WeeklyIntentionsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          intention={null}
          weekStart={weekStart}
          onSave={upsertIntention}
        />
      </>
    );
  }

  // Show summary
  const energyEmoji = ENERGY_EMOJI[intention.social_energy || 'medium'] || '☀️';
  const energyLabel = (intention.social_energy || 'medium').charAt(0).toUpperCase() + (intention.social_energy || 'medium').slice(1);
  const vibeLabels = (intention.vibes || [])
    .map(v => VIBE_CONFIG[v as VibeType]?.label)
    .filter(Boolean);

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className={cn(
          'w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left',
          'transition-colors hover:bg-accent/50 shadow-sm'
        )}
      >
        <span className="text-xl">{energyEmoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {energyLabel} energy · {intention.target_hangouts || 0} hangout{(intention.target_hangouts || 0) !== 1 ? 's' : ''}
            {vibeLabels.length > 0 && ` · ${vibeLabels.join(', ')}`}
          </p>
          {intention.notes && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{intention.notes}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      <WeeklyIntentionsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        intention={intention}
        weekStart={weekStart}
        onSave={upsertIntention}
      />
    </>
  );
}
