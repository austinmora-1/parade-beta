import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { HomeTabs } from '@/components/dashboard/HomeTabs';
import type { StagedFriend } from '@/components/dashboard/QuickPlanDrop';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { DarkModePrompt } from '@/components/dashboard/DarkModePrompt';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { PolishProfileCard } from '@/components/dashboard/PolishProfileCard';
import { FreeWindowCard } from '@/components/dashboard/FreeWindowCard';
import { SmartPrimaryCTA } from '@/components/dashboard/SmartPrimaryCTA';

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
  const { isLoading } = usePlannerStore();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      if (!session?.user) { setCheckingOnboarding(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', session.user.id)
        .single();
      if (data && !(data as any).onboarding_completed) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setCheckingOnboarding(false);
    }
    checkOnboarding();
  }, [session?.user, navigate]);

  const handleAddFriend = useCallback((_friend: StagedFriend) => {
    // No-op: friend staging surface (QuickPlanDrop) was removed from the dashboard.
  }, []);

  if (isLoading || checkingOnboarding) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <EllyWalkthrough />

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
      <motion.div variants={fadeUp}>
        <FriendVibeStrip onFriendTap={handleAddFriend} />
      </motion.div>

      {/* Free-weekend / open-window surface (multiple options) */}
      <motion.div variants={fadeUp}>
        <FreeWindowCard />
      </motion.div>


      {/* Optional: nudge to flesh out profile (interests, goals, etc.) */}
      <motion.div variants={fadeUp}>
        <PolishProfileCard />
      </motion.div>

      {/* Upcoming Plans & Feed */}
      <motion.div variants={fadeUp}>
        <HomeTabs />
      </motion.div>
    </motion.div>
  );
}
