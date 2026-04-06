import { useState, useCallback } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { HomeTabs } from '@/components/dashboard/HomeTabs';
import { QuickPlanDrop, StagedFriend } from '@/components/dashboard/QuickPlanDrop';

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
    <div className="animate-fade-in space-y-6 md:space-y-8">
      <EllyWalkthrough />
      <PushNotificationPrompt />

      {/* Who's around — the social hook, first thing you see */}
      <FriendVibeStrip onFriendTap={handleAddFriend} />

      {/* Quick Plan drop zone */}
      <QuickPlanDrop
        stagedFriends={stagedFriends}
        onAddFriend={handleAddFriend}
        onRemoveFriend={handleRemoveFriend}
        onClear={handleClear}
      />

      {/* Set your own vibe */}
      <VibeSelector />

      {/* Upcoming Plans & Feed */}
      <HomeTabs />
    </div>
  );
}
