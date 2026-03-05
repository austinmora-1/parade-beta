import { useEventSuggestions, EventSuggestion } from '@/hooks/useEventSuggestions';
import { Sparkles, RefreshCw, CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function EventSuggestions() {
  const { suggestions, isLoading, refresh } = useEventSuggestions();
  const navigate = useNavigate();

  if (suggestions.length === 0 && !isLoading) return null;

  const handleTap = (suggestion: EventSuggestion) => {
    // Navigate to plans page to create a plan with prefilled context
    navigate('/plans', {
      state: {
        createPlan: true,
        suggestedTitle: suggestion.title,
        suggestedDay: suggestion.day,
        suggestedTimeSlot: suggestion.time_slot,
      },
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Suggested Plans</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={refresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>

      {isLoading && suggestions.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding plans for you...
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleTap(s)}
              className={cn(
                "flex-shrink-0 w-56 rounded-xl border border-border bg-card p-3 text-left",
                "transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.98]",
                "space-y-1.5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xl">{s.emoji}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {s.day} · {s.time_slot}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug line-clamp-1">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                {s.description}
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <CalendarPlus className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-primary font-medium">Tap to plan</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
