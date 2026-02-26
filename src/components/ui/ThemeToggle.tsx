import { Moon, Sun, Gamepad2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

const themeOrder = ['light', 'dark', 'arcade'] as const;
const themeIcons = {
  light: Sun,
  dark: Moon,
  arcade: Gamepad2,
};
const themeLabels = {
  light: 'Switch to dark mode',
  dark: 'Switch to arcade mode',
  arcade: 'Switch to light mode',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const currentIndex = themeOrder.indexOf((theme as typeof themeOrder[number]) || 'light');
  const nextIndex = (currentIndex + 1) % themeOrder.length;
  const nextTheme = themeOrder[nextIndex];

  const CurrentIcon = themeIcons[(theme as keyof typeof themeIcons) || 'light'] || Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      className="h-7 w-7 rounded-md"
      title={themeLabels[(theme as keyof typeof themeLabels) || 'light']}
    >
      <CurrentIcon className="h-4 w-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
