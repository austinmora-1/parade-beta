import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { X, Plus, Sparkles, Pencil, CalendarHeart, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GifPicker } from '@/components/chat/GifPicker';
import { useWeeklyIntentions } from '@/hooks/useWeeklyIntentions';
import { WeeklyIntentionsSheet } from './WeeklyIntentionsSheet';
import { Progress } from '@/components/ui/progress';
import { useDisplayPlans } from '@/hooks/useDisplayPlans';
import { addDays, isBefore, isSameDay } from 'date-fns';

const VIBE_CHIP_STYLES: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  social:     { bg: 'hsl(5 60% 95%)',   text: 'hsl(5 50% 45%)',   border: 'hsl(5 50% 85%)',   iconBg: 'bg-[hsl(5_80%_65%)]' },
  chill:      { bg: 'hsl(203 50% 93%)', text: 'hsl(203 45% 40%)', border: 'hsl(203 45% 82%)', iconBg: 'bg-[hsl(203_60%_55%)]' },
  athletic:   { bg: 'hsl(152 40% 93%)', text: 'hsl(152 35% 35%)', border: 'hsl(152 35% 78%)', iconBg: 'bg-[hsl(152_39%_39%)]' },
  productive: { bg: 'hsl(49 60% 93%)',  text: 'hsl(49 50% 38%)',  border: 'hsl(49 50% 80%)',  iconBg: 'bg-[hsl(49_80%_50%)]' },
  custom:     { bg: 'hsl(9 45% 95%)',   text: 'hsl(9 40% 45%)',   border: 'hsl(9 40% 82%)',   iconBg: 'bg-[hsl(9_60%_60%)]' },
};

const ENERGY_EMOJI: Record<string, string> = { low: '🌙', medium: '☀️', high: '🔥' };

export function VibeAndIntentionsCard() {
  const { currentVibe, setVibe, addCustomVibe, removeCustomVibe, plans: rawPlans } = usePlannerStore();
  const { intention, loading, upsertIntention, weekStart, completedHangouts } = useWeeklyIntentions();
  const { displayPlans } = useDisplayPlans(rawPlans);
  const [vibeMenuOpen, setVibeMenuOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const plansOnDeck = useMemo(() => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);
    return displayPlans.filter(p => {
      const effectiveEnd = p.endDate || p.date;
      return (p.date > now && isBefore(p.date, weekFromNow)) ||
             (isSameDay(p.date, now)) ||
             (p.endDate && p.date <= now && effectiveEnd >= now);
    }).length;
  }, [displayPlans]);

  const vibeTypes = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

  const handleVibeSelect = useCallback((value: string) => {
    const existingTags = currentVibe?.customTags;
    const existingGif = currentVibe?.gifUrl;
    setVibe({ type: value as VibeType, gifUrl: existingGif, customTags: existingTags });
    setVibeMenuOpen(false);
    setShowCustomInput(false);
  }, [currentVibe, setVibe]);

  const handleCustomSubmit = useCallback(() => {
    if (customText.trim()) {
      addCustomVibe(customText.trim().replace(/\s+/g, ''));
      setCustomText('');
      setShowCustomInput(false);
      setVibeMenuOpen(false);
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

  // Weekly intentions data
  const hasIntention = !!intention;
  const target = intention?.target_hangouts || 1;
  const progressPct = hasIntention ? Math.min(100, Math.round((completedHangouts / target) * 100)) : 0;
  const goalMet = hasIntention && completedHangouts >= target;
  const energyEmoji = ENERGY_EMOJI[intention?.social_energy || 'medium'] || '☀️';

  return (
    <>
      {/* Backdrop overlay for vibe menu */}
      <AnimatePresence>
        {vibeMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => { setVibeMenuOpen(false); setShowCustomInput(false); }}
          />
        )}
      </AnimatePresence>

      <div className={cn(
        'rounded-2xl border bg-card shadow-sm overflow-hidden',
        goalMet ? 'border-green-300 dark:border-green-700' : 'border-border',
        vibeMenuOpen ? 'z-50 relative' : 'z-0'
      )}>
        {/* Top row: vibe selector */}
        <motion.button
          onClick={() => setVibeMenuOpen(o => !o)}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center gap-2.5 px-4 py-3 transition-colors"
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl text-white shrink-0',
              selectedStyle?.iconBg || 'bg-primary'
            )}
          >
            {selectedConfig ? (
              <selectedConfig.icon className="h-4 w-4 text-white" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 text-left">
            {currentVibe?.type ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {selectedConfig?.label || 'Custom'}
                </span>
                {currentVibe.customTags && currentVibe.customTags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {currentVibe.customTags.map(t => `#${t}`).join(' ')}
                  </span>
                )}
                {currentVibe.gifUrl && (
                  <span className="text-[10px] text-muted-foreground">+ GIF</span>
                )}
                {plansOnDeck > 0 && (
                  <span className="text-[10px] text-muted-foreground">·</span>
                )}
                {plansOnDeck > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    {plansOnDeck} plan{plansOnDeck !== 1 ? 's' : ''} on deck
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-muted-foreground">What's your vibe?</span>
                {plansOnDeck > 0 && (
                  <span className="text-[10px] text-muted-foreground">·</span>
                )}
                {plansOnDeck > 0 && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {plansOnDeck} plan{plansOnDeck !== 1 ? 's' : ''} on deck
                  </span>
                )}
              </div>
            )}
          </div>
          <motion.div
            animate={{ rotate: vibeMenuOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </motion.button>

        {/* Vibe menu dropdown */}
        <AnimatePresence>
          {vibeMenuOpen && (
            <div className="flex flex-col items-center gap-2 px-4 pb-3 z-50">
              {vibeTypes.map((type, i) => {
                const config = VIBE_CONFIG[type];
                const style = VIBE_CHIP_STYLES[type];
                const isSelected = currentVibe?.type === type;
                return (
                  <motion.button
                    key={type}
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22, delay: i * 0.04 }}
                    onClick={() => handleVibeSelect(type)}
                    className={cn(
                      'flex w-56 items-center gap-2.5 rounded-2xl px-4 py-2.5 shadow-lg border shrink-0',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    )}
                  >
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white text-sm', style.iconBg)}>
                      <config.icon className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                      {config.label}
                    </span>
                    {isSelected && <span className="ml-auto text-primary text-xs">✓</span>}
                  </motion.button>
                );
              })}

              <AnimatePresence mode="wait">
                {showCustomInput ? (
                  <motion.div key="input" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-56 overflow-hidden shrink-0">
                    <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2 shadow-lg border border-primary">
                      <Pencil className="h-3.5 w-3.5 text-primary" />
                      <input
                        autoFocus
                        placeholder="type a vibe tag..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCustomSubmit();
                          if (e.key === 'Escape') { setShowCustomInput(false); setCustomText(''); }
                        }}
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                      <button onClick={() => { if (customText.trim()) handleCustomSubmit(); else { setShowCustomInput(false); setCustomText(''); } }} className="text-xs font-semibold text-primary">
                        {customText.trim() ? 'Add' : '✕'}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="trigger"
                    initial={{ opacity: 0, y: -10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22, delay: vibeTypes.length * 0.04 }}
                    onClick={() => setShowCustomInput(true)}
                    className="flex w-56 items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5 shadow-lg border border-border shrink-0"
                  >
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white text-sm', VIBE_CHIP_STYLES.custom.iconBg)}>
                      <Pencil className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Add custom tag</span>
                  </motion.button>
                )}
              </AnimatePresence>

              <GifPicker onGifSelect={(url) => { handleGifSelect(url); setVibeMenuOpen(false); }}>
                <motion.button
                  initial={{ opacity: 0, y: -10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22, delay: (vibeTypes.length + 1) * 0.04 }}
                  className="flex w-56 items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5 shadow-lg border border-border shrink-0"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-sm">🎬</div>
                  <span className="text-sm font-medium text-foreground">Add a GIF</span>
                </motion.button>
              </GifPicker>
            </div>
          )}
        </AnimatePresence>

        {/* GIF / custom tags preview */}
        <AnimatePresence>
          {currentVibe?.gifUrl && !vibeMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-2 overflow-hidden">
              <div className="relative inline-block rounded-xl overflow-hidden border border-border">
                <img src={currentVibe.gifUrl} alt="Vibe GIF" className="h-20 max-w-full object-cover rounded-xl" />
                <button onClick={handleRemoveGif} className="absolute top-1 right-1 rounded-full bg-background/80 backdrop-blur-sm p-0.5 hover:bg-background transition-colors">
                  <X className="h-3.5 w-3.5 text-foreground" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {currentVibe?.customTags && currentVibe.customTags.length > 0 && !vibeMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-2 flex flex-wrap items-center gap-1.5 overflow-hidden">
              {currentVibe.customTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  #{tag}
                  <button onClick={() => removeCustomVibe(tag)} className="rounded-full p-0.5 hover:bg-primary/20 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Bottom row: weekly intentions */}
        {!loading && (
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
          >
            {hasIntention ? (
              <>
                <span className="text-lg">{energyEmoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {goalMet ? 'You showed up this week ✨' : 'Showing up for your people'}
                  </p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <Progress
                      value={progressPct}
                      className={cn(
                        'h-1.5 flex-1 bg-[hsl(30_30%_90%)] dark:bg-[hsl(20_15%_22%)]',
                        goalMet && '[&>div]:bg-green-500'
                      )}
                    />
                    <span className={cn(
                      'text-xs font-semibold whitespace-nowrap',
                      goalMet ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    )}>
                      {goalMet ? '✅ ' : ''}{completedHangouts}/{target}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </>
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
                  <CalendarHeart className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">How social are we feeling?</p>
                  <p className="text-xs text-muted-foreground">Set your intentions for the week</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        )}
      </div>

      <WeeklyIntentionsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        intention={intention ?? null}
        weekStart={weekStart}
        onSave={upsertIntention}
      />
    </>
  );
}
