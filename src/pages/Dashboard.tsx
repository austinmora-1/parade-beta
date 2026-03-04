import { useState } from 'react';
import { EllyWalkthrough } from '@/components/onboarding/EllyWalkthrough';
import { PushNotificationPrompt } from '@/components/dashboard/PushNotificationPrompt';
import { usePlannerStore } from '@/stores/plannerStore';

import { WeekOverview } from '@/components/dashboard/WeekOverview';
import { UpcomingPlans } from '@/components/dashboard/UpcomingPlans';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { FriendsAndPodWidget } from '@/components/dashboard/FriendsAndPodWidget';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { NewHangRequestDialog } from '@/components/dashboard/NewHangRequestDialog';
import { Button } from '@/components/ui/button';
import { Plus, CalendarPlus, CalendarArrowUp, UserPlus, Send, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Dashboard() {
  const { isLoading } = usePlannerStore();
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hangRequestOpen, setHangRequestOpen] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-base font-bold md:text-lg">Welcome back! 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">Here's what's happening this week</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-9 w-9 rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setCreatePlanOpen(true)} className="gap-2">
              <CalendarPlus className="h-4 w-4" />
              Create a Plan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)} className="gap-2">
              <CalendarArrowUp className="h-4 w-4" />
              Share Availability
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHangRequestOpen(true)} className="gap-2">
              <Send className="h-4 w-4" />
              Send Hang Request
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInviteFriendOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Friends
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} />
      <InviteFriendDialog open={inviteFriendOpen} onOpenChange={setInviteFriendOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <NewHangRequestDialog
        open={hangRequestOpen}
        onOpenChange={setHangRequestOpen}
      />

      {/* Vibe */}
      <VibeSelector />

      {/* Upcoming Plans */}
      <UpcomingPlans />

      {/* Week Overview */}
      <WeekOverview />

      {/* Friends & Pod Combined */}
      <FriendsAndPodWidget />
    </div>
  );
}
