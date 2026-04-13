import { useState } from 'react';
import { useWeeklyIntentions } from '@/hooks/useWeeklyIntentions';
import { WeeklyIntentionsSheet } from './WeeklyIntentionsSheet';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const ENERGY_EMOJI: Record<string, string> = { low: '🌙', medium: '☀️', high: '🔥' };

export function WeeklyIntentionsSummary() {
  const { intention, loading, upsertIntention, weekStart, completedHangouts } = useWeeklyIntentions();
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

  // Show summary with progress
  const energyEmoji = ENERGY_EMOJI[intention.social_energy || 'medium'] || '☀️';
  const energyLabel = (intention.social_energy || 'medium').charAt(0).toUpperCase() + (intention.social_energy || 'medium').slice(1);
  const vibeLabels = (intention.vibes || [])
    .map(v => VIBE_CONFIG[v as VibeType]?.label)
    .filter(Boolean);

  const target = intention.target_hangouts || 1;
  const progressPct = Math.min(100, Math.round((completedHangouts / target) * 100));
  const goalMet = completedHangouts >= target;

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className={cn(
          'w-full rounded-2xl border bg-card px-4 py-3 text-left',
          'transition-colors hover:bg-accent/50 shadow-sm',
          goalMet ? 'border-green-300 dark:border-green-700' : 'border-border'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{energyEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {energyLabel} energy
              {vibeLabels.length > 0 && ` · ${vibeLabels.join(', ')}`}
            </p>
            {intention.notes && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{intention.notes}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        {/* Progress tracker */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <Progress
            value={progressPct}
            className={cn(
              'h-2 flex-1 bg-[hsl(30_30%_90%)] dark:bg-[hsl(20_15%_22%)]',
              goalMet && '[&>div]:bg-green-500'
            )}
          />
          <span className={cn(
            'text-xs font-semibold whitespace-nowrap',
            goalMet ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}>
            {goalMet ? '✅ ' : ''}{completedHangouts}/{target} hangouts
          </span>
        </div>
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
