import { useState } from 'react';
import { Plus, CalendarPlus, CalendarArrowUp, UserPlus, Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { NewHangRequestDialog } from '@/components/dashboard/NewHangRequestDialog';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';

export function FloatingFeedbackButton() {
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hangRequestOpen, setHangRequestOpen] = useState(false);
  const [sendVibeOpen, setSendVibeOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-[0_4px_20px_hsl(150_40%_45%/0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_6px_28px_hsl(150_40%_45%/0.55)] hover:rotate-90 active:scale-95 md:bottom-6 md:right-6"
            aria-label="Quick actions"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-48 mb-2">
          <DropdownMenuItem onClick={() => setCreatePlanOpen(true)} className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Create a Plan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSendVibeOpen(true)} className="gap-2">
            <Zap className="h-4 w-4" />
            Send Vibe
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

      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} />
      <InviteFriendDialog open={inviteFriendOpen} onOpenChange={setInviteFriendOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <NewHangRequestDialog open={hangRequestOpen} onOpenChange={setHangRequestOpen} />
      <SendVibeDialog open={sendVibeOpen} onOpenChange={setSendVibeOpen} />
    </>
  );
}
