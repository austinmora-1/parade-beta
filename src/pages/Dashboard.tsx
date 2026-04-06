import { useState, useCallback } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { GreetingHeader } from '@/components/dashboard/GreetingHeader';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { HomeTabs } from '@/components/dashboard/HomeTabs';
import { QuickPlanDrop, StagedFriend } from '@/components/dashboard/QuickPlanDrop';

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
  const [stagedFriends, setStagedFriends] = useState<StagedFriend[]>([]);

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

  if (isLoading) {
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
      <EllyWalkthrough />
      <PushNotificationPrompt />

      {/* Personalized greeting */}
      <motion.div variants={fadeUp}>
        <GreetingHeader />
      </motion.div>

      {/* Who's around — the social hook */}
      <motion.div variants={fadeUp}>
        <FriendVibeStrip onFriendTap={handleAddFriend} />
      </motion.div>

      {/* Quick Plan drop zone */}
      <motion.div variants={fadeUp}>
        <QuickPlanDrop
          stagedFriends={stagedFriends}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
          onClear={handleClear}
        />
      </motion.div>

      {/* Set your own vibe */}
      <motion.div variants={fadeUp}>
        <VibeSelector />
      </motion.div>

      {/* Upcoming Plans & Feed */}
      <motion.div variants={fadeUp}>
        <HomeTabs />
      </motion.div>
    </motion.div>
  );
}
