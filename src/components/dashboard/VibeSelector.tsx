import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { X, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CollapsibleWidget } from './CollapsibleWidget';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { GifPicker } from '@/components/chat/GifPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        icon={<Sparkles className="h-4 w-4 text-primary" />}
      >
        <div className="flex items-center gap-2">
          {showCustomInput ? (
            <div className="flex-1 flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 h-9">
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
                  else {
                    setShowCustomInput(false);
                    setCustomText('');
                  }
                }}
                className="text-xs font-medium text-primary hover:text-primary/80"
              >
                {customText.trim() ? 'Add' : '✕'}
              </button>
            </div>
          ) : (
            <Select
              value={currentVibe?.type || ''}
              onValueChange={handleVibeSelect}
            >
              <SelectTrigger className="flex-1 h-9 text-sm [&>span]:line-clamp-none">
                <SelectValue placeholder="Pick a vibe...">
                  {selectedConfig && (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span>{selectedConfig.icon}</span>
                      <span>{selectedConfig.label}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vibeTypes.map((type) => {
                  const config = VIBE_CONFIG[type];
                  return (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                        <span className="text-muted-foreground text-xs ml-1">{config.description}</span>
                      </span>
                    </SelectItem>
                  );
                })}
                <SelectItem value="custom">
                  <span className="flex items-center gap-2">
                    <span>{VIBE_CONFIG.custom.icon}</span>
                    <span>Custom</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          <GifPicker onGifSelect={handleGifSelect}>
            <button
              className={cn(
                "shrink-0 rounded-lg px-3 h-9 text-xs font-medium transition-all duration-200 border",
                currentVibe?.gifUrl
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
              )}
            >
              GIF
            </button>
          </GifPicker>
        </div>

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
