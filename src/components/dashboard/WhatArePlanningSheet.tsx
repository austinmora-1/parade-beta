import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { ChevronRight, UserPlus } from 'lucide-react';

export type PlanningEntry = 'hang' | 'plus-one' | 'trip' | 'free-weekend' | 'invite';

interface WhatArePlanningSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (entry: PlanningEntry) => void;
}

const ENTRIES: { key: PlanningEntry; emoji: string; label: string; hint: string }[] = [
  { key: 'hang',         emoji: '👤',  label: 'Find time with friends',  hint: '"I want to see Alex this week"' },
  { key: 'plus-one',     emoji: '🎟️', label: 'Get a plus-one',     hint: '"Mets game Saturday, need someone"' },
  { key: 'trip',         emoji: '📍',  label: 'Plan a Trip',         hint: '"NYC this fall — or Queens Saturday"' },
];

export function WhatArePlanningSheet({ open, onOpenChange, onSelect }: WhatArePlanningSheetProps) {
  const handle = (key: PlanningEntry) => {
    onOpenChange(false);
    // Allow drawer close animation to start before triggering parent state changes
    setTimeout(() => onSelect(key), 80);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-base font-semibold">What are you planning?</DrawerTitle>
          <DrawerDescription className="text-xs">
            Pick whatever comes to mind first — we'll fill in the rest.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-2">
          {ENTRIES.map((e) => (
            <button
              key={e.key}
              onClick={() => handle(e.key)}
              className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
            >
              <span className="text-2xl shrink-0" aria-hidden>{e.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{e.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">{e.hint}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>

        <div className="border-t border-border mt-2 px-4 py-3 pb-5">
          <button
            onClick={() => handle('invite')}
            className="w-full flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite friends to Parade</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default WhatArePlanningSheet;
