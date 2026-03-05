import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FeedView } from '@/components/feed/FeedView';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';

export default function Dashboard() {
  const { isLoading } = usePlannerStore();

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

      {/* Friend Vibes */}
      <FriendVibeStrip />

      {/* Vibe */}
      <VibeSelector />

      {/* Feed */}
      <FeedView />
    </div>
  );
}
