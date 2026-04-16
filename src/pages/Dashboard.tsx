import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { VibeAndIntentionsCard } from '@/components/dashboard/VibeAndIntentionsCard';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { DarkModePrompt } from '@/components/dashboard/DarkModePrompt';
import type { StagedFriend } from '@/components/dashboard/QuickPlanDrop';

// Lazy-load below-the-fold widgets to shrink initial dashboard JS
const EllyWalkthrough = lazy(() =>
  import('@/components/onboarding/EllyWalkthrough').then((m) => ({ default: m.EllyWalkthrough })),
);
const QuickPlanDrop = lazy(() =>
  import('@/components/dashboard/QuickPlanDrop').then((m) => ({ default: m.QuickPlanDrop })),
);
const HomeTabs = lazy(() =>
  import('@/components/dashboard/HomeTabs').then((m) => ({ default: m.HomeTabs })),
);

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
  const [stagedFriends, setStagedFriends] = useState<StagedFriend[]>([]);
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

  const handleAddFriend = useCallback((friend: StagedFriend) => {
    setStagedFriends(prev => {
      if (prev.some(f => f.userId === friend.userId)) return prev;
      return [...prev, friend];
    });
  }, []);

  const handleRemoveFriend = useCallback((userId: string) => {
    setStagedFriends(prev => prev.filter(f => f.userId !== userId));
  }, []);

  const handleClear = useCallback(() => {
    setStagedFriends([]);
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
      className="space-y-5 md:space-y-7"
    >
      <Suspense fallback={null}>
        <EllyWalkthrough />
      </Suspense>
      <PushNotificationPrompt />

      {/* Personalized greeting */}
      <motion.div variants={fadeUp}>
        <GreetingHeader />
      </motion.div>

      {/* Dark mode suggestion after 9 PM */}
      <DarkModePrompt />

      {/* Vibe + Weekly Intentions (consolidated) */}
      <motion.div variants={fadeUp}>
        <VibeAndIntentionsCard />
      </motion.div>

      {/* Who's around — the social hook */}
      <motion.div variants={fadeUp}>
        <FriendVibeStrip onFriendTap={handleAddFriend} />
      </motion.div>

      {/* Quick Plan drop zone */}
      <motion.div variants={fadeUp}>
        <Suspense fallback={<div className="h-32" />}>
          <QuickPlanDrop
            stagedFriends={stagedFriends}
            onAddFriend={handleAddFriend}
            onRemoveFriend={handleRemoveFriend}
            onClear={handleClear}
          />
        </Suspense>
      </motion.div>

      {/* Upcoming Plans & Feed */}
      <motion.div variants={fadeUp}>
        <Suspense fallback={<div className="h-48" />}>
          <HomeTabs />
        </Suspense>
      </motion.div>
    </motion.div>
  );
}
