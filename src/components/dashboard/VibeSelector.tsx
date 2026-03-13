import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { X, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CollapsibleWidget } from './CollapsibleWidget';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { GifPicker } from '@/components/chat/GifPicker';

// Map vibe CSS variable names to inline colors for the chips
const VIBE_CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  social:     { bg: 'hsl(350 80% 95%)', text: 'hsl(350 80% 42%)', border: 'hsl(350 80% 80%)' },
  chill:      { bg: 'hsl(200 55% 93%)', text: 'hsl(200 55% 35%)', border: 'hsl(200 55% 75%)' },
  athletic:   { bg: 'hsl(145 65% 92%)', text: 'hsl(145 65% 32%)', border: 'hsl(145 65% 70%)' },
  productive: { bg: 'hsl(38 90% 93%)',  text: 'hsl(38 80% 36%)',  border: 'hsl(38 90% 72%)' },
  custom:     { bg: 'hsl(270 40% 94%)', text: 'hsl(270 50% 45%)', border: 'hsl(270 40% 78%)' },
};

export function VibeSelector() {
  const { currentVibe, setVibe, addCustomVibe, removeCustomVibe } = usePlannerStore();
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showAddMoreInput, setShowAddMoreInput] = useState(false);
  const [addMoreText, setAddMoreText] = useState('');
  const [sendVibeOpen, setSendVibeOpen] = useState(false);

  const vibeTypes = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

  const handleVibeSelect = (value: string) => {
    if (value === 'custom') {
      setVibe({ type: 'custom', gifUrl: currentVibe?.gifUrl, customTags: currentVibe?.customTags });
      setShowCustomInput(true);
    } else {
      setVibe({ type: value as VibeType, gifUrl: currentVibe?.gifUrl });
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

  const handleGifSelect = (gifUrl: string) => {
    const vibeType = currentVibe?.type || 'social';
    setVibe({
      ...currentVibe,
      type: vibeType,
      gifUrl,
    });
  };

  const handleRemoveGif = () => {
    if (currentVibe) {
      setVibe({ ...currentVibe, gifUrl: undefined });
    }
  };

  const selectedConfig = currentVibe?.type ? VIBE_CONFIG[currentVibe.type] : null;

  return (
    <>
      <CollapsibleWidget
        title="What's your vibe?"
        icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
        compact
      >
        {/* Vibe chips row — one tap to select */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-hide">
          {vibeTypes.map((type) => {
            const config = VIBE_CONFIG[type];
            const isSelected = currentVibe?.type === type;
            const chipStyle = VIBE_CHIP_STYLES[type];
            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                onClick={() => handleVibeSelect(type)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                )}
                style={isSelected ? {
                  backgroundColor: chipStyle.bg,
                  color: chipStyle.text,
                  borderColor: chipStyle.border,
                  boxShadow: `0 0 0 2px ${chipStyle.border}`,
                } : {
                  backgroundColor: 'transparent',
                  color: 'hsl(var(--muted-foreground))',
                  borderColor: 'hsl(var(--border))',
                }}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </motion.button>
            );
          })}

          {/* Custom chip */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            onClick={() => handleVibeSelect('custom')}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150"
            style={currentVibe?.type === 'custom' ? {
              backgroundColor: VIBE_CHIP_STYLES.custom.bg,
              color: VIBE_CHIP_STYLES.custom.text,
              borderColor: VIBE_CHIP_STYLES.custom.border,
              boxShadow: `0 0 0 2px ${VIBE_CHIP_STYLES.custom.border}`,
            } : {
              backgroundColor: 'transparent',
              color: 'hsl(var(--muted-foreground))',
              borderColor: 'hsl(var(--border))',
            }}
          >
            <span>{VIBE_CONFIG.custom.icon}</span>
            <span>Custom</span>
          </motion.button>

          <GifPicker onGifSelect={handleGifSelect}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className={cn(
                'flex shrink-0 items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150',
                currentVibe?.gifUrl
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              GIF {currentVibe?.gifUrl ? '✓' : ''}
            </motion.button>
          </GifPicker>
        </div>

        {/* Custom vibe text input */}
        <AnimatePresence>
          {showCustomInput && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 h-9 mt-2">
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
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <button
                  onClick={() => {
                    if (customText.trim()) handleCustomSubmit();
                    else { setShowCustomInput(false); setCustomText(''); }
                  }}
                  className="text-xs font-medium text-primary hover:text-primary/80"
                >
                  {customText.trim() ? 'Add' : '✕'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current GIF preview */}
        <AnimatePresence>
          {currentVibe?.gifUrl && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 overflow-hidden"
            >
              <div className="relative inline-block rounded-xl overflow-hidden border border-border">
                <img
                  src={currentVibe.gifUrl}
                  alt="Vibe GIF"
                  className="h-24 max-w-full object-cover rounded-xl"
                />
                <button
                  onClick={handleRemoveGif}
                  className="absolute top-1 right-1 rounded-full bg-background/80 backdrop-blur-sm p-0.5 hover:bg-background transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-foreground" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom tags */}
        <AnimatePresence>
          {currentVibe?.type === 'custom' && currentVibe.customTags && currentVibe.customTags.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 flex flex-wrap items-center gap-1.5 overflow-hidden"
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