import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FriendsAndPodWidget } from '@/components/dashboard/FriendsAndPodWidget';
import { FeedView } from '@/components/feed/FeedView';

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

      {/* Vibe */}
      <VibeSelector />

      {/* Friends & Pod Combined */}
      <FriendsAndPodWidget />

      {/* Feed */}
      <FeedView />
    </div>
  );
}
