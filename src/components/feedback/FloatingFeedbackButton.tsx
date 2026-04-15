import { useState } from 'react';
import { Plus, CalendarPlus, PlaneTakeoff, UserPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import { AddTripDialog } from '@/components/profile/AddTripDialog';
import { usePlannerStore } from '@/stores/plannerStore';

export function FloatingFeedbackButton() {
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);
  const loadProfileAndAvailability = usePlannerStore((s) => s.loadProfileAndAvailability);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="fixed bottom-6 right-6 z-40 hidden md:flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/30 backdrop-blur-[2px] border-2 border-primary shadow-[0_4px_20px_hsl(150_40%_45%/0.3)] transition-all duration-300 hover:scale-110 hover:bg-primary/40 hover:shadow-[0_6px_28px_hsl(150_40%_45%/0.45)] active:scale-95 group outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent] select-none"
            aria-label="Quick actions"
          >
            <Plus className="h-6 w-6 stroke-[2.5] text-primary transition-transform duration-300 group-hover:rotate-90" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
          <DropdownMenuItem onClick={() => setQuickPlanOpen(true)} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Make a Plan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTripOpen(true)} className="gap-2">
            <PlaneTakeoff className="h-4 w-4" />
            Add a Trip
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setInviteFriendOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Friends
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QuickPlanSheet open={quickPlanOpen} onOpenChange={setQuickPlanOpen} />
      <InviteFriendDialog open={inviteFriendOpen} onOpenChange={setInviteFriendOpen} />
      <AddTripDialog open={tripOpen} onOpenChange={setTripOpen} onTripAdded={() => loadProfileAndAvailability()} />
    </>
  );
}
