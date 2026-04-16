import { Moon, Sun, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useColorScheme, ColorScheme } from '@/hooks/useColorScheme';
import { cn } from '@/lib/utils';

export function AppearanceQuickToggles() {
  const { theme, setTheme } = useTheme();
  const { scheme, setScheme } = useColorScheme();
  const isDark = theme === 'dark';

  const schemes: { id: ColorScheme; color: string }[] = [
    { id: 'coral', color: 'hsl(5 100% 68%)' },
    { id: 'green', color: 'hsl(152 39% 39%)' },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {schemes.map((s) => {
          const selected = scheme === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setScheme(s.id)}
              aria-label={`${s.id} theme`}
              aria-pressed={selected}
              className={cn(
                'relative h-5 w-5 rounded-full border transition-all',
                selected ? 'border-foreground ring-1 ring-foreground/30' : 'border-border hover:border-foreground/40'
              )}
              style={{ background: s.color }}
            >
              {selected && (
                <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label="Toggle dark mode"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
