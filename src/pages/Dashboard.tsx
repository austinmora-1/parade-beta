import { useState } from 'react';
import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { usePlannerStore } from '@/stores/plannerStore';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { WeekOverview } from '@/components/dashboard/WeekOverview';
import { UpcomingPlans } from '@/components/dashboard/UpcomingPlans';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { LocationToggle } from '@/components/dashboard/LocationToggle';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { HangRequests } from '@/components/dashboard/HangRequests';
import { AvailableFriends } from '@/components/dashboard/AvailableFriends';
import { EllyWidget } from '@/components/dashboard/EllyWidget';
import { PodWidget } from '@/components/dashboard/PodWidget';
import { ReceivedVibes } from '@/components/dashboard/ReceivedVibes';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { isLoading } = usePlannerStore();
  const [createPlanOpen, setCreatePlanOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Elly Walkthrough for first-time users */}
      <EllyWalkthrough />
      <PushNotificationPrompt />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-base font-bold md:text-lg">Welcome back! 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">Here's what's happening this week</p>
        </div>
        <div className="flex items-center gap-2">
          <LocationToggle />
          <Button size="sm" className="gap-2" onClick={() => setCreatePlanOpen(true)}>
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          <ShareDialog />
        </div>
      </div>

      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} />

      {/* Vibe */}
      <VibeSelector />

      {/* Received Vibes */}
      <ReceivedVibes />

      {/* Upcoming Plans */}
      <UpcomingPlans />

      {/* Week Overview */}
      <WeekOverview />

      {/* Elly AI Assistant */}
      <EllyWidget />

      {/* Pod Widget */}
      <PodWidget />

      {/* Available Friends & Hang Requests */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AvailableFriends />
        <HangRequests />
      </div>

      {/* Quick Stats */}
      <QuickStats />
    </div>
  );
}
