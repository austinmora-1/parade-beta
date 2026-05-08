import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCustomActivities } from '@/hooks/useCustomActivities';
import { VIBE_CONFIG, type CustomActivity, type VibeType } from '@/types/planner';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const ICON_OPTIONS = [
  '✨','🎉','🎊','🍻','🍷','🍕','🍣','🍔','🍰','☕','🍹','🍝','🍳','🥗',
  '🎬','🎵','🎤','🎮','🎲','🎨','🎭','📚','📷','🎸','🎺','🥁',
  '🏃','🚴','🏋️','🧘','🏊','⚽','🏀','🎾','🏐','🥊','⛳','🎿','🏄','🥾',
  '🌳','🌊','🏔️','🏖️','🌅','🔥','🛶','🎣','⛺',
  '🛍️','🛒','💼','💻','📝','📊','🧪','🧠',
  '🐶','🐱','🦋','🌸','💐','🎁','💝','💃','🕺','🪩',
];

const VIBE_OPTIONS: { id: VibeType; label: string; emoji: string }[] = [
  { id: 'social', label: 'Social', emoji: '🥂' },
  { id: 'chill', label: 'Chill', emoji: '☕' },
  { id: 'athletic', label: 'Athletic', emoji: '🏃' },
  { id: 'productive', label: 'Productive', emoji: '🎯' },
];

interface CustomActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the activity has been saved to the user's profile. */
  onCreated?: (activity: CustomActivity) => void;
  initialLabel?: string;
}

/**
 * Lets the user create a brand-new activity category.
 * Pick an icon → name it → choose a vibe → save to profile so it
 * shows up across every activity selector going forward.
 */
export function CustomActivityDialog({ open, onOpenChange, onCreated, initialLabel = '' }: CustomActivityDialogProps) {
  const { addCustomActivity } = useCustomActivities();
  const [label, setLabel] = useState(initialLabel);
  const [icon, setIcon] = useState<string>(ICON_OPTIONS[0]);
  const [vibeType, setVibeType] = useState<VibeType>('social');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(initialLabel);
      setIcon(ICON_OPTIONS[0]);
      setVibeType('social');
      setSaving(false);
    }
  }, [open, initialLabel]);

  const canSave = label.trim().length > 0 && !!icon && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const created = await addCustomActivity({ label, icon, vibeType });
    setSaving(false);
    if (!created) {
      toast.error('Couldn’t save that activity. Try again?');
      return;
    }
    toast.success(`Added "${created.label}"`);
    onCreated?.(created);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create custom activity</DialogTitle>
          <DialogDescription>
            Save your own category — it will show up everywhere you pick an activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="custom-activity-label" className="text-xs uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input
              id="custom-activity-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Sound bath, Pickleball, Run club"
              maxLength={40}
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Icon</Label>
            <div className="mt-2 grid grid-cols-9 gap-1.5 max-h-44 overflow-y-auto rounded-xl border border-border p-2 bg-muted/30">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center text-lg transition-all',
                    icon === emoji
                      ? 'bg-primary/15 ring-2 ring-primary scale-110'
                      : 'hover:bg-muted'
                  )}
                  aria-label={`Pick ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vibe</Label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {VIBE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVibeType(v.id)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs flex flex-col items-center gap-0.5 transition-all',
                    vibeType === v.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <span className="text-base">{v.emoji}</span>
                  <span className="font-medium">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <div className="text-sm">
              <div className="font-medium text-foreground">{label.trim() || 'Your activity'}</div>
              <div className="text-[11px] text-muted-foreground">
                {VIBE_CONFIG[vibeType].label} · saved to your account
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save activity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomActivityDialog;
