import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, Plus } from 'lucide-react';

export function VibeSelector() {
  const { currentVibe, setVibe, addCustomVibe, removeCustomVibe } = usePlannerStore();
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showAddMoreInput, setShowAddMoreInput] = useState(false);
  const [addMoreText, setAddMoreText] = useState('');
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
      addCustomVibe(customText.trim().replace(/\s+/g, ''));
      setCustomText('');
      setShowCustomInput(false);
    }
  };

  const handleAddMoreSubmit = () => {
    if (addMoreText.trim()) {
      addCustomVibe(addMoreText.trim().replace(/\s+/g, ''));
      setAddMoreText('');
      setShowAddMoreInput(false);
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
              
              if (type === 'custom' && showCustomInput) {
                return (
                  <input
                    key={type}
                    autoFocus
                    placeholder="vibe"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomSubmit();
                      if (e.key === 'Escape') {
                        setShowCustomInput(false);
                        setCustomText('');
                      }
                    }}
                    onBlur={() => {
                      if (customText.trim()) handleCustomSubmit();
                      else setShowCustomInput(false);
                    }}
                    className="flex-1 rounded-lg py-1.5 px-2 text-xs font-medium bg-primary/10 text-primary outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
                  />
                );
              }
              
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
        {currentVibe?.type === 'custom' && currentVibe.customTags && currentVibe.customTags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {currentVibe.customTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                #{tag}
                <button
                  onClick={() => removeCustomVibe(tag)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {showAddMoreInput ? (
              <input
                autoFocus
                placeholder="vibe"
                value={addMoreText}
                onChange={(e) => setAddMoreText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMoreSubmit();
                  if (e.key === 'Escape') {
                    setShowAddMoreInput(false);
                    setAddMoreText('');
                  }
                }}
                onBlur={() => {
                  if (addMoreText.trim()) handleAddMoreSubmit();
                  else setShowAddMoreInput(false);
                }}
                className="h-5 w-20 rounded-full bg-muted px-2 text-xs outline-none focus:ring-1 focus:ring-primary/50"
              />
            ) : (
              <button
                onClick={() => setShowAddMoreInput(true)}
                className="inline-flex items-center justify-center rounded-full bg-muted h-5 w-5 text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
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
          
          if (type === 'custom' && showCustomInput) {
            return (
              <div
                key={type}
                className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4"
              >
                <span className="text-2xl">{config.icon}</span>
                <input
                  autoFocus
                  placeholder="type your vibe..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomSubmit();
                    if (e.key === 'Escape') {
                      setShowCustomInput(false);
                      setCustomText('');
                    }
                  }}
                  onBlur={() => {
                    if (customText.trim()) handleCustomSubmit();
                    else setShowCustomInput(false);
                  }}
                  className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                />
              </div>
            );
          }
          
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
              </div>
            </button>
          );
        })}
      </div>

      {currentVibe?.type === 'custom' && currentVibe.customTags && currentVibe.customTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {currentVibe.customTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              #{tag}
              <button
                onClick={() => removeCustomVibe(tag)}
                className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {showAddMoreInput ? (
            <input
              autoFocus
              placeholder="vibe"
              value={addMoreText}
              onChange={(e) => setAddMoreText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddMoreSubmit();
                if (e.key === 'Escape') {
                  setShowAddMoreInput(false);
                  setAddMoreText('');
                }
              }}
              onBlur={() => {
                if (addMoreText.trim()) handleAddMoreSubmit();
                else setShowAddMoreInput(false);
              }}
              className="h-7 w-24 rounded-full bg-muted px-3 text-sm outline-none focus:ring-1 focus:ring-primary/50"
            />
          ) : (
            <button
              onClick={() => setShowAddMoreInput(true)}
              className="inline-flex items-center justify-center rounded-full bg-muted h-7 w-7 text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
