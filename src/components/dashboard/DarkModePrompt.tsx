import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useVibeStore } from '@/stores/vibeStore';
import { getCurrentTimeInTimezone } from '@/lib/timezone';

const STORAGE_KEY = 'parade-dark-mode-prompt';
const AUTO_DARK_KEY = 'parade-auto-dark-after-9pm';
const PRE_AUTO_DARK_THEME_KEY = 'parade-pre-auto-dark-theme';
const SESSION_COUNT_KEY = 'parade-session-count';
const MIN_SESSIONS = 3;

// Hour thresholds (in user's local time)
const AUTO_DARK_HOUR = 21; // 9 PM — switch to dark
const AUTO_REVERT_HOUR = 8; // 8 AM — return to user's preferred theme

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

function getSessionCount(): number {
  try {
    return parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Returns the current hour (0–23) in the user's local timezone, falling
 * back to the browser's local time if no profile timezone is available.
 */
function getLocalHour(timezone: string | null | undefined): number {
  if (timezone) {
    try {
      return getCurrentTimeInTimezone(timezone).hours;
    } catch {
      // fall through to browser default
    }
  }
  return new Date().getHours();
}

export function DarkModePrompt() {
  const { theme, setTheme } = useTheme();
  const userTimezone = useVibeStore((s) => s.userTimezone);
  const [visible, setVisible] = useState(false);
  const [autoSwitch, setAutoSwitch] = useState(false);

  useEffect(() => {
    const hour = getLocalHour(userTimezone);
    const todayStr = new Date().toISOString().slice(0, 10);
    const stored = getStoredState();
    const sessions = getSessionCount();

    // 1) Auto-revert: between 8 AM and 9 PM local time, if we previously
    //    auto-switched the user to dark, restore their preferred theme.
    if (hour >= AUTO_REVERT_HOUR && hour < AUTO_DARK_HOUR) {
      const preTheme = localStorage.getItem(PRE_AUTO_DARK_THEME_KEY);
      if (preTheme && theme === 'dark' && preTheme !== 'dark') {
        setTheme(preTheme);
        localStorage.removeItem(PRE_AUTO_DARK_THEME_KEY);
        return;
      }
      // If we're already on the user's preferred theme, just clear the marker.
      if (preTheme && theme === preTheme) {
        localStorage.removeItem(PRE_AUTO_DARK_THEME_KEY);
      }
      return;
    }

    // 2) Auto-darken: at/after 9 PM local time, if auto-dark is enabled and
    //    the user is currently on a non-dark theme, switch to dark and
    //    remember what they were on so we can restore it after 8 AM.
    if (isAutoDarkEnabled() && hour >= AUTO_DARK_HOUR && theme && theme !== 'dark') {
      localStorage.setItem(PRE_AUTO_DARK_THEME_KEY, theme);
      setTheme('dark');
      return;
    }

    // 3) Prompt — only show after the user's 3rd session, after 9 PM,
    //    on light theme, and not already dismissed today.
    if (
      sessions >= MIN_SESSIONS &&
      hour >= AUTO_DARK_HOUR &&
      theme === 'light' &&
      stored.dismissedDate !== todayStr
    ) {
      setVisible(true);
    }
  }, [theme, setTheme, userTimezone]);

  const dismiss = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedDate: todayStr }));
    setVisible(false);
  };

  const handleSwitchToDark = () => {
    if (autoSwitch) {
      localStorage.setItem(AUTO_DARK_KEY, 'true');
    }
    // Remember the theme we're switching from so it can be restored at 8 AM.
    if (theme && theme !== 'dark') {
      localStorage.setItem(PRE_AUTO_DARK_THEME_KEY, theme);
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
                Easier on the eyes at night 🌙 — we'll switch back in the morning.
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
