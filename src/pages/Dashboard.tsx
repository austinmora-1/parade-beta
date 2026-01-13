import { usePlannerStore } from '@/stores/plannerStore';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { WeekOverview } from '@/components/dashboard/WeekOverview';
import { UpcomingPlans } from '@/components/dashboard/UpcomingPlans';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { LocationToggle } from '@/components/dashboard/LocationToggle';
import { Button } from '@/components/ui/button';
import { Plus, Share2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Welcome back! 👋</h1>
          <p className="mt-1 text-muted-foreground">Here's what's happening this week</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share Availability
          </Button>
          <Link to="/plans">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <WeekOverview />
          <UpcomingPlans />
        </div>
        <div className="space-y-6">
          <VibeSelector />
          <LocationToggle />
        </div>
      </div>
    </div>
  );
}
