import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { X, Plus, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CollapsibleWidget } from './CollapsibleWidget';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { Button } from '@/components/ui/button';

export function VibeSelector() {
  const { currentVibe, setVibe, addCustomVibe, removeCustomVibe } = usePlannerStore();
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showAddMoreInput, setShowAddMoreInput] = useState(false);
  const [addMoreText, setAddMoreText] = useState('');
  const [sendVibeOpen, setSendVibeOpen] = useState(false);
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

  const vibeTypes = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

  const vibeColors: Record<string, string> = {
    social: 'hsl(var(--vibe-social))',
    chill: 'hsl(var(--vibe-chill))',
    athletic: 'hsl(var(--vibe-athletic))',
    productive: 'hsl(var(--vibe-productive))',
    custom: 'hsl(var(--primary))',
  };

  return (
    <>
    <CollapsibleWidget
      title="What's your vibe?"
      icon={<Sparkles className="h-4 w-4 text-primary" />}
      headerRight={
        <Button size="sm" variant="soft" className="gap-1.5 h-7 px-2.5 text-xs" onClick={() => setSendVibeOpen(true)}>
          <Zap className="h-3.5 w-3.5" />
          Send Vibe
        </Button>
      }
    >

      {/* Vibe pills */}
      <div className="flex flex-wrap gap-1.5">
        {vibeTypes.map((type) => {
          const config = VIBE_CONFIG[type];
          const isSelected = currentVibe?.type === type;

          return (
            <motion.button
              key={type}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleVibeSelect(type)}
              className={cn(
                "relative flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200",
                isSelected
                  ? "text-primary-foreground shadow-md"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              )}
              style={isSelected ? { backgroundColor: vibeColors[type] } : undefined}
            >
              <span className="text-sm">{config.icon}</span>
              <span>{config.label}</span>
              {isSelected && (
                <motion.div
                  layoutId="vibe-glow"
                  className="absolute inset-0 rounded-full"
                  style={{ boxShadow: `0 0 16px ${vibeColors[type]}40` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
            </motion.button>
          );
        })}

        {/* Custom vibe button / input */}
        <AnimatePresence mode="wait">
          {showCustomInput ? (
            <motion.div
              key="input"
              initial={{ width: 40, opacity: 0.5 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 40, opacity: 0 }}
              className="flex items-center gap-1 rounded-full border-2 border-primary/40 bg-primary/5 px-2.5 py-0.5"
            >
              <span className="text-sm">{VIBE_CONFIG.custom.icon}</span>
              <input
                autoFocus
                placeholder="type a vibe..."
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
                className="w-24 bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground/60"
              />
            </motion.div>
          ) : (
            <motion.button
              key="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleVibeSelect('custom')}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 border-2 border-dashed",
                currentVibe?.type === 'custom'
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              <Plus className="h-3 w-3" />
              <span>Custom</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Custom tags */}
      <AnimatePresence>
        {currentVibe?.type === 'custom' && currentVibe.customTags && currentVibe.customTags.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 flex flex-wrap items-center gap-1.5 overflow-hidden"
          >
            {currentVibe.customTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                #{tag}
                <button
                  onClick={() => removeCustomVibe(tag)}
                  className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
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
                className="h-6 w-20 rounded-full bg-muted px-2.5 text-xs outline-none focus:ring-1 focus:ring-primary/50"
              />
            ) : (
              <button
                onClick={() => setShowAddMoreInput(true)}
                className="inline-flex items-center justify-center rounded-full bg-muted h-6 w-6 text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </CollapsibleWidget>
    <SendVibeDialog open={sendVibeOpen} onOpenChange={setSendVibeOpen} />
    </>
  );
}
