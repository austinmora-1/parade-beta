import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DISMISS_KEY = (uid: string) => `parade.polishProfile.dismissed.${uid}`;

/**
 * Lightweight, dismissible nudge that surfaces the optional profile fields
 * (interests, social goals, social cap, preferred social times) we removed
 * from the streamlined 4-step onboarding. Only renders when the user hasn't
 * filled any of them yet and hasn't dismissed the card.
 */
export function PolishProfileCard() {
  const { session } = useAuth();
  const [needsPolish, setNeedsPolish] = useState(false);
  const [missingCount, setMissingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const userId = session?.user?.id;
    if (!userId) return;

    // Respect prior dismissal
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage.getItem(DISMISS_KEY(userId))) return;
      } catch {
        // ignore
      }
    }

    supabase
      .from('profiles')
      .select('interests, social_goals, social_cap, preferred_social_times')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const missing = [
          !data.interests || data.interests.length === 0,
          !data.social_goals || data.social_goals.length === 0,
          data.social_cap == null,
          !data.preferred_social_times || data.preferred_social_times.length === 0,
        ].filter(Boolean).length;
        if (missing >= 3) {
          setMissingCount(missing);
          setNeedsPolish(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const handleDismiss = () => {
    setNeedsPolish(false);
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      window.localStorage.setItem(DISMISS_KEY(userId), new Date().toISOString());
    } catch {
      // ignore
    }
  };

  if (!needsPolish) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">
            Polish your profile
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add interests, goals, and your favorite hangout windows so we can
            line up better matches. {missingCount} quick things left.
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Add details
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
