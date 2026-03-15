import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FriendVibeStrip } from '@/components/dashboard/FriendVibeStrip';
import { HomeTabs } from '@/components/dashboard/HomeTabs';

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

      {/* Who's around — the social hook, first thing you see */}
      <FriendVibeStrip />

      {/* Set your own vibe */}
      <VibeSelector />

      {/* Upcoming Plans & Feed */}
      <HomeTabs />
    </div>
  );
}
      <VibeSelector />

      {/* Upcoming Plans & Feed */}
      <HomeTabs />
    </div>
  );
}