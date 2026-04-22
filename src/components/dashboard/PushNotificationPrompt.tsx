import { useState, useEffect, useMemo } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { usePlansStore } from '@/stores/plansStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const STORAGE_KEY = 'parade-push-prompt';

interface PromptState {
  // 'never' once user has enabled, permanently dismissed, or browser denied
  resolved: boolean;
  // last time we showed it (for soft cool-down between dismissals)
  lastShownAt: string | null;
}

function getStoredState(): PromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { resolved: false, lastShownAt: null };
  } catch {
    return { resolved: false, lastShownAt: null };
  }
}

function setStoredState(next: PromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Phase 1.2 — push prompt fires only after the user has at least one
 * confirmed plan they own. Hidden if push is unsupported, already granted,
 * already denied, or previously dismissed.
 */
export function PushNotificationPrompt() {
  const { user } = useAuth();
  const plans = usePlansStore((s) => s.plans);
  const { isSupported, permission, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  const hasConfirmedOwnPlan = useMemo(() => {
    if (!user) return false;
    return plans.some(
      (p) => p.userId === user.id && p.status === 'confirmed'
    );
  }, [plans, user]);

  useEffect(() => {
    if (!isSupported) return;
    if (permission !== 'default') return; // already granted or denied
    if (isSubscribed) return;
    if (!hasConfirmedOwnPlan) return;

    const stored = getStoredState();
    if (stored.resolved) return;

    setVisible(true);
    setStoredState({ ...stored, lastShownAt: new Date().toISOString() });
  }, [isSupported, permission, isSubscribed, hasConfirmedOwnPlan]);

  const dismiss = () => {
    setStoredState({ resolved: true, lastShownAt: new Date().toISOString() });
    setVisible(false);
  };

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast.success("You're set — we'll ping you about plans");
      setStoredState({ resolved: true, lastShownAt: new Date().toISOString() });
      setVisible(false);
    } else {
      // Permission denied or failed — don't keep nagging
      setStoredState({ resolved: true, lastShownAt: new Date().toISOString() });
      setVisible(false);
    }
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
              <Bell className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="space-y-2 flex-1 pr-4">
              <p className="text-sm font-medium text-foreground">
                Get a nudge when plans firm up?
              </p>
              <p className="text-xs text-muted-foreground">
                We'll only ping you for the stuff that actually matters — invites,
                changes, and reminders.
              </p>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleEnable}
                  disabled={isLoading}
                  className="text-xs h-8"
                >
                  {isLoading ? 'Enabling…' : 'Turn on notifications'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismiss}
                  className="text-xs h-8 text-muted-foreground"
                >
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
