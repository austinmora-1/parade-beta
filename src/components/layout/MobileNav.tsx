import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MessageCircle, Clock, Plus, CalendarPlus, CalendarArrowUp, UserPlus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import { useConversations } from '@/hooks/useChat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InviteFriendDialog } from '@/components/friends/InviteFriendDialog';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

const leftNav = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/availability', icon: Clock, label: 'Avail' },
];

const rightNav = [
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
];

export function MobileNav() {
  const location = useLocation();
  const { conversations } = useConversations();
  const totalUnreadDMs = conversations.filter(c => c.unread_count > 0).length;

  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [inviteFriendOpen, setInviteFriendOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sendVibeOpen, setSendVibeOpen] = useState(false);

  const renderNavItem = (item: typeof leftNav[0]) => {
    const isActive = location.pathname === item.path;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        className="relative flex flex-col items-center gap-0.5 px-3 py-1"
      >
        <div className="relative flex h-9 w-9 items-center justify-center">
          {isActive && (
            <motion.div
              layoutId="nav-pill"
              className="absolute inset-0 rounded-xl bg-sidebar-accent"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <item.icon
            className={cn(
              'relative h-5 w-5 transition-colors duration-150',
              isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50'
            )}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
          {item.path === '/friends' && totalUnreadDMs > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
              {totalUnreadDMs > 9 ? '9+' : totalUnreadDMs}
            </span>
          )}
        </div>
        <span
          className={cn(
            'text-[10px] font-medium transition-colors duration-150',
            isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50'
          )}
        >
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar pb-safe md:hidden">
        <div className="flex items-center justify-around px-2 py-1.5">
          <LayoutGroup>
            {leftNav.map(renderNavItem)}

            {/* Center FAB - raised above the bar */}
            <div className="relative flex flex-col items-center gap-0.5 px-3 py-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="-mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-[0_4px_16px_hsl(var(--primary)/0.4)] transition-all duration-200 hover:scale-105 active:scale-95 outline-none focus:outline-none focus-visible:outline-none [-webkit-tap-highlight-color:transparent] select-none group"
                    aria-label="Quick actions"
                  >
                    <Plus className="h-6 w-6 stroke-[2.5] text-primary-foreground transition-transform duration-300 group-hover:rotate-90" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-48 mb-2">
                  <DropdownMenuItem onClick={() => setQuickPlanOpen(true)} className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Make a Plan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSendVibeOpen(true)} className="gap-2">
                    <Zap className="h-4 w-4" />
                    Send Vibe
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShareOpen(true)} className="gap-2">
                    <CalendarArrowUp className="h-4 w-4" />
                    Share Availability
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setInviteFriendOpen(true)} className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Friends
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {rightNav.map(renderNavItem)}
          </LayoutGroup>
        </div>
      </nav>

      <QuickPlanSheet open={quickPlanOpen} onOpenChange={setQuickPlanOpen} />
      <InviteFriendDialog open={inviteFriendOpen} onOpenChange={setInviteFriendOpen} />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <SendVibeDialog open={sendVibeOpen} onOpenChange={setSendVibeOpen} />
    </>
  );
}
