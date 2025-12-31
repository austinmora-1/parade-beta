import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Sparkles } from 'lucide-react';

export function VibeSelector() {
  const { currentVibe, setVibe } = usePlannerStore();
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

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

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
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
