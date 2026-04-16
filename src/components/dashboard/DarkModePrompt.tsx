import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'parade-dark-mode-prompt';
const AUTO_DARK_KEY = 'parade-auto-dark-after-9pm';

interface PromptState {
  dismissedDate: string | null; // ISO date string — dismissed once per day
}

function getStoredState(): PromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { dismissedDate: null };
  } catch {
    return { dismissedDate: null };
  }
}

function isAutoDarkEnabled(): boolean {
  return localStorage.getItem(AUTO_DARK_KEY) === 'true';
}

export function DarkModePrompt() {
  const { theme, setTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [autoSwitch, setAutoSwitch] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    const todayStr = new Date().toISOString().slice(0, 10);
    const stored = getStoredState();

    // If auto-dark is enabled, silently switch and don't show prompt
    if (isAutoDarkEnabled() && hour >= 21 && theme === 'light') {
      setTheme('dark');
      return;
    }

    // Show prompt if: after 9pm, light theme, not already dismissed today
    if (hour >= 21 && theme === 'light' && stored.dismissedDate !== todayStr) {
      setVisible(true);
    }
  }, [theme, setTheme]);

  const dismiss = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedDate: todayStr }));
    setVisible(false);
  };

  const handleSwitchToDark = () => {
    if (autoSwitch) {
      localStorage.setItem(AUTO_DARK_KEY, 'true');
    }
    setTheme('dark');
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <button
            onClick={dismiss}
            className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Moon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="space-y-2 flex-1 pr-4">
              <p className="text-sm font-medium text-foreground">
                It's getting late — switch to dark mode?
              </p>
              <p className="text-xs text-muted-foreground">
                Easier on the eyes at night 🌙
              </p>

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="auto-dark"
                  checked={autoSwitch}
                  onCheckedChange={setAutoSwitch}
                  className="scale-90"
                />
                <label htmlFor="auto-dark" className="text-xs text-muted-foreground cursor-pointer">
                  Do this automatically after 9 PM
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSwitchToDark} className="text-xs h-8">
                  Switch to dark mode
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss} className="text-xs h-8 text-muted-foreground">
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
