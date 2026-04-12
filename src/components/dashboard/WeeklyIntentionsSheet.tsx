import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WeeklyIntention } from '@/hooks/useWeeklyIntentions';
import { format, parseISO, addDays } from 'date-fns';

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low', emoji: '🌙', desc: 'Quiet week' },
  { value: 'medium', label: 'Medium', emoji: '☀️', desc: 'Balanced' },
  { value: 'high', label: 'High', emoji: '🔥', desc: 'Let\'s go!' },
];

const HANGOUT_OPTIONS = [1, 2, 3, 4, 5];
const VIBE_TYPES = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

const VIBE_CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  social:     { bg: 'hsl(350 80% 95%)', text: 'hsl(350 80% 42%)', border: 'hsl(350 80% 80%)' },
  chill:      { bg: 'hsl(200 55% 93%)', text: 'hsl(200 55% 35%)', border: 'hsl(200 55% 75%)' },
  athletic:   { bg: 'hsl(145 65% 92%)', text: 'hsl(145 65% 32%)', border: 'hsl(145 65% 70%)' },
  productive: { bg: 'hsl(38 90% 93%)',  text: 'hsl(38 80% 36%)',  border: 'hsl(38 90% 72%)' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intention: WeeklyIntention | null;
  weekStart: string;
  onSave: (values: { social_energy: string; target_hangouts: number; vibes: string[]; notes: string }) => Promise<void>;
}

export function WeeklyIntentionsSheet({ open, onOpenChange, intention, weekStart, onSave }: Props) {
  const [energy, setEnergy] = useState(intention?.social_energy || 'medium');
  const [hangouts, setHangouts] = useState(intention?.target_hangouts || 2);
  const [vibes, setVibes] = useState<string[]>(intention?.vibes || []);
  const [notes, setNotes] = useState(intention?.notes || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEnergy(intention?.social_energy || 'medium');
      setHangouts(intention?.target_hangouts || 2);
      setVibes(intention?.vibes || []);
      setNotes(intention?.notes || '');
    }
  }, [open, intention]);

  const toggleVibe = (v: string) => {
    setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ social_energy: energy, target_hangouts: hangouts, vibes, notes });
      toast.success('Intentions saved! 🎯');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const weekEnd = format(addDays(parseISO(weekStart), 6), 'MMM d');
  const weekStartLabel = format(parseISO(weekStart), 'MMM d');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg">Weekly Intentions</SheetTitle>
          <p className="text-sm text-muted-foreground">{weekStartLabel} – {weekEnd}</p>
        </SheetHeader>

        <div className="space-y-5 pt-2">
          {/* Energy Level */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Social energy</label>
            <div className="grid grid-cols-3 gap-2">
              {ENERGY_LEVELS.map(e => (
                <button
                  key={e.value}
                  onClick={() => setEnergy(e.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 transition-all text-center',
                    energy === e.value
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40'
                  )}
                >
                  <span className="text-xl">{e.emoji}</span>
                  <span className="text-sm font-medium">{e.label}</span>
                  <span className="text-[11px] text-muted-foreground">{e.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Hangouts */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">How many hangouts?</label>
            <div className="flex gap-2">
              {HANGOUT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setHangouts(n)}
                  className={cn(
                    'h-10 w-10 rounded-full border-2 text-sm font-semibold transition-all',
                    hangouts === n
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Vibes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Vibes for the week</label>
            <div className="flex flex-wrap gap-2">
              {VIBE_TYPES.map(type => {
                const config = VIBE_CONFIG[type];
                const style = VIBE_CHIP_STYLES[type];
                const selected = vibes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleVibe(type)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-all',
                      selected ? 'ring-2 ring-primary/30 shadow-sm' : 'opacity-70 hover:opacity-100'
                    )}
                    style={{
                      backgroundColor: style?.bg,
                      color: style?.text,
                      borderColor: selected ? style?.text : style?.border,
                    }}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Any goals? (optional)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Try a new restaurant, reconnect with an old friend…"
              className="resize-none"
              rows={2}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Saving…' : intention ? 'Update intentions' : 'Set intentions 🎯'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
