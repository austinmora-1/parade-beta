import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlannerStore } from '@/stores/plannerStore';
import { ElephantLoader } from '@/components/ui/ElephantLoader';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { HomeTabs } from '@/components/dashboard/HomeTabs';
import type { StagedFriend } from '@/components/dashboard/QuickPlanDrop';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { DarkModePrompt } from '@/components/dashboard/DarkModePrompt';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { PolishProfileCard } from '@/components/dashboard/PolishProfileCard';
import { FreeWindowCard } from '@/components/dashboard/FreeWindowCard';
import { SmartPrimaryCTA } from '@/components/dashboard/SmartPrimaryCTA';

const ONBOARDING_CHECK_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Onboarding check timed out')), timeoutMs);
    }),
  ]);
}

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function Dashboard() {
  const { isLoading, loadError, forceRefresh } = usePlannerStore();
  const { session, authError, retryAuth } = useAuth();
  const navigate = useNavigate();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingTick, setOnboardingTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function checkOnboarding() {
      if (!session?.user) {
        if (!cancelled) {
          setOnboardingError(null);
          setCheckingOnboarding(false);
        }
        return;
      }
      if (!cancelled) {
        setCheckingOnboarding(true);
        setOnboardingError(null);
      }
      try {
        const response = await withTimeout(
          Promise.resolve(supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('user_id', session.user.id)
            .single()),
          ONBOARDING_CHECK_TIMEOUT_MS
        );
        if (cancelled) return;
        const data = (response as { data: { onboarding_completed?: boolean } | null }).data;
        if (data && !(data as any).onboarding_completed) {
          navigate('/onboarding', { replace: true });
          return;
        }
      } catch (error) {
        console.warn('Onboarding check failed:', error);
        if (!cancelled) {
          setOnboardingError('We couldn’t verify your account. Please try again.');
        }
      }
      if (!cancelled) setCheckingOnboarding(false);
    }
    checkOnboarding();
    return () => { cancelled = true; };
  }, [session?.user, navigate, onboardingTick]);

  const handleAddFriend = useCallback((_friend: StagedFriend) => {
    // No-op: friend staging surface (QuickPlanDrop) was removed from the dashboard.
  }, []);

  const errorMessage = authError || onboardingError || loadError;

  const handleRetry = useCallback(() => {
    if (authError) retryAuth();
    if (onboardingError) setOnboardingTick((n) => n + 1);
    if (loadError) {
      void forceRefresh();
    }
  }, [authError, onboardingError, loadError, retryAuth, forceRefresh]);

  if (errorMessage && !isLoading && !checkingOnboarding) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{errorMessage}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || checkingOnboarding) {
    return (
      <div className="flex h-64 items-center justify-center">
        <ElephantLoader />
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-8 md:space-y-12 pt-2 md:pt-4 pb-6"
    >
      {/* Personalized greeting */}
      <motion.div variants={fadeUp}>
        <GreetingHeader />
      </motion.div>

      {/* Dark mode suggestion after 3rd session, after 9 PM */}
      <DarkModePrompt />

      {/* Push notification prompt — fires after first confirmed plan */}
      <PushNotificationPrompt />

      {/* State-aware primary CTA — picks open-invite, today's plan, etc. */}
      <motion.div variants={fadeUp}>
        <SmartPrimaryCTA />
      </motion.div>

      {/* Who's around — the social hook */}
      <motion.div variants={fadeUp} data-tour="vibe-strip">
        <FriendVibeStrip onFriendTap={handleAddFriend} />
      </motion.div>

      {/* Free-weekend / open-window surface (multiple options) */}
      <motion.div variants={fadeUp} data-tour="free-windows">
        <FreeWindowCard />
      </motion.div>


      {/* Optional: nudge to flesh out profile (interests, goals, etc.) */}
      <motion.div variants={fadeUp}>
        <PolishProfileCard />
      </motion.div>

      {/* Upcoming Plans & Feed */}
      <motion.div variants={fadeUp} data-tour="home-tabs">
        <HomeTabs />
      </motion.div>
    </motion.div>
  );
}
