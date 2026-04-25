import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WeeklyIntention } from '@/hooks/useWeeklyIntentions';
import { format, parseISO, addDays } from 'date-fns';
import { X, Plus, Check } from 'lucide-react';

const ENERGY_LEVELS = [
  { value: 'low', label: 'Low-key', emoji: '🛋️', desc: 'Recharging this week' },
  { value: 'medium', label: 'Balanced', emoji: '⚖️', desc: 'A couple good hangs' },
  { value: 'high', label: 'All in', emoji: '🔥', desc: 'Let\'s see everyone' },
];

const VIBE_TYPES = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

const VIBE_CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  social:     { bg: 'hsl(5 60% 95%)',   text: 'hsl(5 50% 45%)',   border: 'hsl(5 50% 85%)' },
  chill:      { bg: 'hsl(203 50% 93%)', text: 'hsl(203 45% 40%)', border: 'hsl(203 45% 82%)' },
  athletic:   { bg: 'hsl(152 40% 93%)', text: 'hsl(152 35% 35%)', border: 'hsl(152 35% 78%)' },
  productive: { bg: 'hsl(49 60% 93%)',  text: 'hsl(49 50% 38%)',  border: 'hsl(49 50% 80%)' },
};

const SUGGESTIONS = [
  'Try a new restaurant',
  'Reconnect with an old friend',
  'Host a game night',
  'Go for a hike',
  'Coffee catch-up',
  'Cook dinner together',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intention: WeeklyIntention | null;
  weekStart: string;
  onSave: (values: { social_energy: string; target_hangouts: number; vibes: string[]; notes: string }) => Promise<void>;
}

interface TodoItem {
  text: string;
  done: boolean;
}

/** Parse notes string into to-do items. Lines may be prefixed with "[x] " or "[ ] ". */
function parseItems(notes: string): TodoItem[] {
  if (!notes) return [];
  return notes
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      const checkedMatch = line.match(/^\[([ xX])\]\s+(.*)$/);
      if (checkedMatch) {
        return { text: checkedMatch[2].trim(), done: checkedMatch[1].toLowerCase() === 'x' };
      }
      return { text: line, done: false };
    })
    .filter(i => i.text.length > 0);
}

/** Serialize to-do items back into a notes string with checkbox markers. */
function serializeItems(items: TodoItem[]): string {
  return items.map(i => `[${i.done ? 'x' : ' '}] ${i.text}`).join('\n');
}

export function WeeklyIntentionsSheet({ open, onOpenChange, intention, weekStart, onSave }: Props) {
  const [energy, setEnergy] = useState(intention?.social_energy || 'medium');
  const [vibes, setVibes] = useState<string[]>(intention?.vibes || []);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEnergy(intention?.social_energy || 'medium');
      setVibes(intention?.vibes || []);
      setItems(parseItems(intention?.notes || ''));
      setInputValue('');
    }
  }, [open, intention]);

  const toggleVibe = (v: string) => {
    setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const addItem = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed && !items.some(i => i.text === trimmed)) {
      setItems(prev => [...prev, { text: trimmed, done: false }]);
    }
    setInputValue('');
  }, [items]);

  const removeItem = useCallback((idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const toggleItem = useCallback((idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, done: !it.done } : it));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const notes = serializeItems(items);
      await onSave({ social_energy: energy, target_hangouts: items.length || 1, vibes, notes });
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

  // Filter out suggestions already added
  const availableSuggestions = SUGGESTIONS.filter(s => !items.some(i => i.text === s));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-lg font-display">How's your week looking?</SheetTitle>
          <p className="text-sm text-muted-foreground">{weekStartLabel} – {weekEnd}</p>
        </SheetHeader>

        <div className="space-y-5 pt-2">
          {/* Energy Level */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">How's your social battery?</label>
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
                  <span className="text-sm font-medium font-display">{e.label}</span>
                  <span className="text-[11px] text-muted-foreground">{e.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Vibes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">What's your vibe this week?</label>
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
                    <config.icon className="h-3.5 w-3.5" />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Things to do — to-do list */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Anything you want to do this week?</label>

            {/* To-do list */}
            {items.length > 0 && (
              <ul className="space-y-1 mb-2.5 rounded-xl border border-border bg-card/50 p-1.5">
                {items.map((item, idx) => (
                  <li
                    key={idx}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(idx)}
                      aria-pressed={item.done}
                      aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                        item.done
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-background hover:border-primary/60'
                      )}
                    >
                      {item.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>
                    <span
                      onClick={() => toggleItem(idx)}
                      className={cn(
                        'flex-1 text-sm cursor-pointer select-none',
                        item.done && 'line-through text-muted-foreground'
                      )}
                    >
                      {item.text}
                    </span>
                    <button
                      onClick={() => removeItem(idx)}
                      aria-label="Remove item"
                      className="rounded-full p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted transition-all"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Input row */}
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addItem(inputValue); }
                }}
                placeholder="e.g. Try that new taco spot…"
                className="flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addItem(inputValue)}
                disabled={!inputValue.trim()}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick suggestions */}
            {availableSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {availableSuggestions.slice(0, 4).map(s => (
                  <button
                    key={s}
                    onClick={() => addItem(s)}
                    className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Saving…' : intention ? 'Update intentions' : 'Let\'s do this 🎯'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
