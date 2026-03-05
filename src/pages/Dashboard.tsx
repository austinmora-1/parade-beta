import { usePlannerStore } from '@/stores/plannerStore';
import { Loader2 } from 'lucide-react';

import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { FriendsAndPodWidget } from '@/components/dashboard/FriendsAndPodWidget';

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

      {/* Header */}
      <div>
        <h1 className="font-display text-base font-bold md:text-lg">Welcome back! 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">Here's what's happening this week</p>
      </div>

      {/* Vibe */}
      <VibeSelector />

      {/* Friends & Pod Combined */}
      <FriendsAndPodWidget />
    </div>
  );
}
