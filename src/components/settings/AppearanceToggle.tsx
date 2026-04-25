import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { useColorScheme, ColorScheme } from '@/hooks/useColorScheme';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function AppearanceToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const { scheme, setScheme } = useColorScheme();

  const schemes: { id: ColorScheme; label: string; description: string; primary: string; accent: string }[] = [
    {
      id: 'coral',
      label: 'Coral',
      description: 'Coral primary, green accents',
      primary: 'hsl(5 100% 68%)',
      accent: 'hsl(152 39% 39%)',
    },
    {
      id: 'green',
      label: 'Green',
      description: 'Green primary, coral accents',
      primary: 'hsl(152 39% 39%)',
      accent: 'hsl(5 100% 68%)',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pt-1">
        <div>
          <p className="text-sm font-medium">Dark Mode</p>
          <p className="text-[10px] text-muted-foreground">Switch between light and dark theme</p>
        </div>
        <Switch
          checked={isDark}
          onCheckedChange={(checked) => {
            // User explicitly chose a theme — clear any auto-dark restore marker
            try { localStorage.removeItem('parade-pre-auto-dark-theme'); } catch {}
            setTheme(checked ? 'dark' : 'light');
          }}
        />
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Color Scheme</p>
          <p className="text-[10px] text-muted-foreground">Choose your accent palette</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {schemes.map((s) => {
            const selected = scheme === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScheme(s.id)}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all',
                  selected
                    ? 'border-primary ring-2 ring-primary/30 bg-accent'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                )}
                aria-pressed={selected}
              >
                {selected && (
                  <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-6 w-6 rounded-full border border-border/50"
                    style={{ background: s.primary }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-border/50"
                    style={{ background: s.accent }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
