import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { X, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { GifPicker } from '@/components/chat/GifPicker';

const VIBE_CHIP_STYLES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  social:     { bg: 'hsl(350 80% 95%)', text: 'hsl(350 80% 42%)', border: 'hsl(350 80% 80%)', iconBg: 'bg-[hsl(350_80%_55%)]' },
  chill:      { bg: 'hsl(200 55% 93%)', text: 'hsl(200 55% 35%)', border: 'hsl(200 55% 75%)', iconBg: 'bg-[hsl(200_55%_45%)]' },
  athletic:   { bg: 'hsl(145 65% 92%)', text: 'hsl(145 65% 32%)', border: 'hsl(145 65% 70%)', iconBg: 'bg-[hsl(145_65%_38%)]' },
  productive: { bg: 'hsl(38 90% 93%)',  text: 'hsl(38 80% 36%)',  border: 'hsl(38 90% 72%)',  iconBg: 'bg-[hsl(38_90%_52%)]' },
  custom:     { bg: 'hsl(270 40% 94%)', text: 'hsl(270 50% 45%)', border: 'hsl(270 40% 78%)', iconBg: 'bg-[hsl(270_50%_55%)]' },
};

export function VibeSelector() {
  const { currentVibe, setVibe, addCustomVibe, removeCustomVibe } = usePlannerStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sendVibeOpen, setSendVibeOpen] = useState(false);

  const vibeTypes = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');
  const allVibes = [...vibeTypes, 'custom' as const];

  const handleVibeSelect = useCallback((value: string) => {
    if (value === 'custom') {
      setVibe({ type: 'custom', gifUrl: currentVibe?.gifUrl, customTags: currentVibe?.customTags });
      setShowCustomInput(true);
      // Keep menu open for custom input
      return;
    }
    setVibe({ type: value as VibeType, gifUrl: currentVibe?.gifUrl });
    setMenuOpen(false);
    setShowCustomInput(false);
  }, [currentVibe, setVibe]);

  const handleCustomSubmit = useCallback(() => {
    if (customText.trim()) {
      addCustomVibe(customText.trim().replace(/\s+/g, ''));
      setCustomText('');
      setShowCustomInput(false);
      setMenuOpen(false);
    }
  }, [customText, addCustomVibe]);

  const handleGifSelect = useCallback((gifUrl: string) => {
    const vibeType = currentVibe?.type || 'social';
    setVibe({ ...currentVibe, type: vibeType, gifUrl });
  }, [currentVibe, setVibe]);

  const handleRemoveGif = useCallback(() => {
    if (currentVibe) {
      setVibe({ ...currentVibe, gifUrl: undefined });
    }
  }, [currentVibe, setVibe]);

  const selectedConfig = currentVibe?.type ? VIBE_CONFIG[currentVibe.type] : null;
  const selectedStyle = currentVibe?.type ? VIBE_CHIP_STYLES[currentVibe.type] : null;

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => { setMenuOpen(false); setShowCustomInput(false); }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-50">
        {/* Trigger row: shows current vibe or prompt */}
        <motion.button
          onClick={() => setMenuOpen(o => !o)}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 transition-all',
            'border shadow-sm',
            currentVibe?.type
              ? 'border-border bg-card'
              : 'border-border bg-card'
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl text-white shrink-0',
              selectedStyle?.iconBg || 'bg-primary'
            )}
          >
            {selectedConfig ? (
              <span className="text-base">{selectedConfig.icon}</span>
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 text-left">
            {currentVibe?.type ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {currentVibe.type === 'custom'
                    ? currentVibe.customTags?.map(t => `#${t}`).join(' ') || 'Custom'
                    : selectedConfig?.label}
                </span>
                {currentVibe.gifUrl && (
                  <span className="text-[10px] text-muted-foreground">+ GIF</span>
                )}
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">What's your vibe?</span>
            )}
          </div>
          <motion.div
            animate={{ rotate: menuOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </motion.button>

        {/* Pop-up menu */}
        <AnimatePresence>
          {menuOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 flex flex-col items-center gap-2 z-50">
              {/* GIF picker row */}
              <GifPicker onGifSelect={(url) => { handleGifSelect(url); setMenuOpen(false); }}>
                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0 }}
                  className="flex w-56 items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5 shadow-lg border border-border"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-sm">
                    🎬
                  </div>
                  <span className="text-sm font-medium text-foreground">Add a GIF</span>
                </motion.button>
              </GifPicker>

              {/* Custom input (appears when custom is selected) */}
              <AnimatePresence>
                {showCustomInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-56 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 shadow-lg border border-primary">
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
                        className="text-xs font-semibold text-primary"
                      >
                        {customText.trim() ? 'Add' : '✕'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Vibe options */}
              {allVibes.map((type, i) => {
                const config = VIBE_CONFIG[type as VibeType];
                const style = VIBE_CHIP_STYLES[type];
                const isSelected = currentVibe?.type === type;

                return (
                  <motion.button
                    key={type}
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 22,
                      delay: i * 0.04,
                    }}
                    onClick={() => handleVibeSelect(type)}
                    className={cn(
                      'flex w-56 items-center gap-2.5 rounded-2xl px-4 py-2.5 shadow-lg border',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                  >
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white text-sm', style.iconBg)}>
                      {config.icon}
                    </div>
                    <span className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                      {type === 'custom' ? 'Custom' : config.label}
                    </span>
                    {isSelected && (
                      <span className="ml-auto text-primary text-xs">✓</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Attached GIF/custom tags preview below trigger */}
        <AnimatePresence>
          {currentVibe?.gifUrl && !menuOpen && (
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
                  className="h-20 max-w-full object-cover rounded-xl"
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

        <AnimatePresence>
          {currentVibe?.type === 'custom' && currentVibe.customTags && currentVibe.customTags.length > 0 && !menuOpen && (
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SendVibeDialog open={sendVibeOpen} onOpenChange={setSendVibeOpen} />
    </>
  );
}
