import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { useIsMobile } from '@/hooks/use-mobile';

export function VibeSelector() {
  const { currentVibe, setVibe } = usePlannerStore();
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const isMobile = useIsMobile();

  const handleVibeSelect = (type: VibeType) => {
    if (type === 'custom') {
      setShowCustomInput(true);
    } else {
      setVibe({ type });
      setShowCustomInput(false);
    }
  };

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      setVibe({ type: 'custom', customText: customText.trim() });
      setShowCustomInput(false);
    }
  };

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground shrink-0">Vibe</span>
          <div className="flex flex-1 gap-1">
            {(Object.keys(VIBE_CONFIG) as VibeType[]).map((type) => {
              const config = VIBE_CONFIG[type];
              const isSelected = currentVibe?.type === type;
              
              return (
                <button
                  key={type}
                  onClick={() => handleVibeSelect(type)}
                  className={cn(
                    "flex-1 flex items-center justify-center rounded-lg py-1.5 px-2 text-xs font-medium transition-all min-w-0",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="truncate">{config.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {showCustomInput && (
          <div className="mt-2 flex gap-2 animate-fade-in">
            <Input
              placeholder="What's your vibe?"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              className="flex-1 h-8 text-sm"
            />
            <Button onClick={handleCustomSubmit} size="sm" className="h-8 px-3">
              Set
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">Current Vibe</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(VIBE_CONFIG) as VibeType[]).map((type) => {
          const config = VIBE_CONFIG[type];
          const isSelected = currentVibe?.type === type;
          
          return (
            <button
              key={type}
              onClick={() => handleVibeSelect(type)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-transparent bg-muted/50 hover:bg-muted"
              )}
            >
              <span className="text-2xl">{config.icon}</span>
              <div className="text-left">
                <p className="font-medium">{config.label}</p>
                {type === 'custom' && currentVibe?.type === 'custom' && currentVibe.customText && (
                  <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {currentVibe.customText}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {showCustomInput && (
        <div className="mt-4 flex gap-2 animate-fade-in">
          <Input
            placeholder="What's your vibe today?"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            className="flex-1"
          />
          <Button onClick={handleCustomSubmit} size="sm">
            Set
          </Button>
        </div>
      )}
    </div>
  );
}
