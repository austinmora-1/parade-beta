import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';

export function AppearanceToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex items-center justify-between pt-1">
      <div>
        <p className="text-sm font-medium">Dark Mode</p>
        <p className="text-[10px] text-muted-foreground">Switch between light and dark theme</p>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          setTheme(checked ? 'dark' : 'light');
        }}
      />
    </div>
  );
}
