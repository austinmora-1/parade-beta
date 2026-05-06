import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useVibeStore } from '@/stores/vibeStore';
import { getCurrentTimeInTimezone } from '@/lib/timezone';

// Automatic theme schedule (user's local time):
//   - 21:00 (9 PM)  → switch to dark
//   - 07:00 (7 AM)  → switch to light
//
// Users can still manually toggle theme at any time. A manual change holds
// until the next scheduled boundary is crossed, at which point we auto-switch
// again.
const AUTO_DARK_HOUR = 21;
const AUTO_LIGHT_HOUR = 7;

// Tracks which "period" the auto-switcher last applied ('day' | 'night').
// If the current period differs, we apply the matching theme. Manual toggles
// do NOT touch this key, so the next boundary will still auto-override them.
const LAST_AUTO_PERIOD_KEY = 'parade-last-auto-period';

type Period = 'day' | 'night';

function getLocalHour(timezone: string | null | undefined): number {
  if (timezone) {
    try {
      return getCurrentTimeInTimezone(timezone).hours;
    } catch {
      // fall through
    }
  }
  return new Date().getHours();
}

function periodForHour(hour: number): Period {
  return hour >= AUTO_DARK_HOUR || hour < AUTO_LIGHT_HOUR ? 'night' : 'day';
}

export function DarkModePrompt() {
  const { theme, setTheme } = useTheme();
  const userTimezone = useVibeStore((s) => s.userTimezone);

  useEffect(() => {
    if (!theme) return;

    const apply = () => {
      const hour = getLocalHour(userTimezone);
      const currentPeriod = periodForHour(hour);
      const lastPeriod = (() => {
        try { return localStorage.getItem(LAST_AUTO_PERIOD_KEY) as Period | null; } catch { return null; }
      })();

      if (lastPeriod !== currentPeriod) {
        const desired = currentPeriod === 'night' ? 'dark' : 'light';
        if (theme !== desired) setTheme(desired);
        try { localStorage.setItem(LAST_AUTO_PERIOD_KEY, currentPeriod); } catch { /* no-op */ }
      }
    };

    apply();
    // Re-check every minute so the boundary triggers while the app is open.
    const id = window.setInterval(apply, 60_000);
    return () => window.clearInterval(id);
  }, [theme, setTheme, userTimezone]);

  return null;
}
