import { useState } from 'react';
import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
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
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-lg font-bold md:text-2xl">Welcome back! 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">Here's what's happening this week</p>
        </div>
        <div className="flex gap-2">
          <ShareDialog />
          <Button size="sm" className="gap-2" onClick={() => setCreatePlanOpen(true)}>
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
        </div>
      </div>

      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} />

      {/* Week Overview */}
      <WeekOverview />

      {/* Elly AI Assistant */}
      <EllyWidget />


      {/* Vibe & Location Status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <VibeSelector />
        <LocationToggle />
      </div>

      {/* Available Friends & Hang Requests */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AvailableFriends />
        <HangRequests />
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Upcoming Plans */}
      <UpcomingPlans />
    </div>
  );
}
