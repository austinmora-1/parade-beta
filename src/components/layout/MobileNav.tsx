import { NavLink, useLocation } from 'react-router-dom';
import {
  House,
  CalendarDays,
  Users,
  Inbox,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import { useState } from 'react';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { useNotifications } from '@/hooks/useNotifications';
import { useConversations } from '@/hooks/useChat';

// Five primary destinations — consistent with desktop sidebar labels
const navItems = [
  { path: '/',             icon: House,           label: 'Home'    },
  { path: '/availability', icon: CalendarDays,    label: 'Plans'   },
  // + FAB sits in the center slot (index 2) — not a nav item
  { path: '/friends',      icon: Users,           label: 'Friends' },
  { path: '/inbox',        icon: Inbox,           label: 'Inbox'   },
];

// Split into left pair and right pair so the FAB sits in the middle
const leftItems  = navItems.slice(0, 2);
const rightItems = navItems.slice(2);

export function MobileNav() {
  const location = useLocation();
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const { totalNotifications } = useNotifications();
  const { conversations } = useConversations();

  const unreadChats = conversations.filter(c => c.unread_count > 0).length;
  const inboxCount  = totalNotifications + unreadChats;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/availability') return location.pathname.startsWith('/availability') || location.pathname.startsWith('/plans');
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar pb-safe mb-1 md:hidden">
        <div className="flex items-end justify-around px-1 py-1.5">
          <LayoutGroup>
            {/* Left items */}
            {leftItems.map((item) => {
              const active = isActive(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="relative flex flex-col items-center gap-0.5 flex-1 py-0.5"
                >
                  <div className="relative flex h-9 w-9 items-center justify-center">
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl bg-sidebar-accent"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        'relative h-5 w-5 transition-colors duration-150',
                        active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45'
                      )}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium transition-colors duration-150',
                    active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45'
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}

            {/* Center FAB */}
            <div className="flex flex-col items-center flex-1 pb-1">
              <motion.button
                onClick={() => setCreatePlanOpen(true)}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/25"
                aria-label="New plan"
              >
                <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
              </motion.button>
            </div>

            {/* Right items */}
            {rightItems.map((item) => {
              const active = isActive(item.path);
              const isInbox = item.path === '/inbox';
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="relative flex flex-col items-center gap-0.5 flex-1 py-0.5"
                >
                  <div className="relative flex h-9 w-9 items-center justify-center">
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-xl bg-sidebar-accent"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        'relative h-5 w-5 transition-colors duration-150',
                        active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45'
                      )}
                      strokeWidth={active ? 2.2 : 1.8}
                    />
                    {/* Inbox unread badge */}
                    {isInbox && inboxCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                        {inboxCount > 9 ? '9+' : inboxCount}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium transition-colors duration-150',
                    active ? 'text-sidebar-primary' : 'text-sidebar-foreground/45'
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </LayoutGroup>
        </div>
      </nav>

      <CreatePlanDialog open={createPlanOpen} onOpenChange={setCreatePlanOpen} />
    </>
  );
}
