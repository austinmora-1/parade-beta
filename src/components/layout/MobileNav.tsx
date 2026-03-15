import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  CalendarDays,
  Users,
  Inbox,
  Plus,
  Share2,
  X,
  Zap,
  Sparkles,
  MessageCirclePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';
import { SendVibeDialog } from '@/components/vibes/SendVibeDialog';
import { useNotifications } from '@/hooks/useNotifications';
import { useConversations } from '@/hooks/useChat';

const navItems = [
  { path: '/',             icon: House,        label: 'Home'    },
  { path: '/availability', icon: CalendarDays, label: 'Plans'   },
  { path: '/friends',      icon: Users,        label: 'Friends' },
  { path: '/inbox',        icon: Inbox,        label: 'Inbox'   },
];

const leftItems  = navItems.slice(0, 2);
const rightItems = navItems.slice(2);

const fabActions = [
  { id: 'quick-plan', icon: Sparkles,          label: 'Quick Plan',  color: 'bg-primary' },
  { id: 'send-vibe',  icon: Zap,               label: 'Send Vibe',   color: 'bg-secondary' },
  { id: 'new-chat',   icon: MessageCirclePlus, label: 'New Chat',    color: 'bg-accent-foreground' },
] as const;

type FabAction = typeof fabActions[number]['id'];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [quickPlanOpen, setQuickPlanOpen] = useState(false);
  const [sendVibeOpen, setSendVibeOpen] = useState(false);
  const { totalNotifications } = useNotifications();
  const { conversations } = useConversations();

  const unreadChats = conversations.filter(c => c.unread_count > 0).length;
  const inboxCount  = totalNotifications + unreadChats;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/availability') return location.pathname.startsWith('/availability') || location.pathname.startsWith('/plans');
    return location.pathname.startsWith(path);
  };

  const handleFabAction = useCallback((id: FabAction) => {
    setFabOpen(false);
    // Small delay so the menu closes before opening the next dialog
    setTimeout(() => {
      switch (id) {
        case 'quick-plan':
          setQuickPlanOpen(true);
          break;
        case 'send-vibe':
          setSendVibeOpen(true);
          break;
        case 'new-chat':
          navigate('/inbox');
          break;
      }
    }, 150);
  }, [navigate]);

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm md:hidden"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

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

            {/* Center FAB with pop-up actions */}
            <div className="relative flex flex-col items-center flex-1 pb-1">
              {/* Pop-up action items */}
              <AnimatePresence>
                {fabOpen && (
                  <div className="absolute bottom-16 flex flex-col items-center gap-3">
                    {fabActions.map((action, i) => (
                      <motion.button
                        key={action.id}
                        initial={{ opacity: 0, y: 20, scale: 0.6 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.6 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 22,
                          delay: (fabActions.length - 1 - i) * 0.05,
                        }}
                        onClick={() => handleFabAction(action.id)}
                        className="flex items-center gap-2.5 rounded-2xl bg-card px-4 py-2.5 shadow-lg border border-border"
                      >
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-xl', action.color)}>
                          <action.icon className="h-4 w-4 text-primary-foreground" strokeWidth={2.2} />
                        </div>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                          {action.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                )}
              </AnimatePresence>

              {/* FAB button */}
              <motion.button
                onClick={() => setFabOpen((o) => !o)}
                animate={{ rotate: fabOpen ? 45 : 0 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-md shadow-primary/25"
                aria-label={fabOpen ? 'Close menu' : 'Create new'}
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

      <QuickPlanSheet open={quickPlanOpen} onOpenChange={setQuickPlanOpen} />
      <SendVibeDialog open={sendVibeOpen} onOpenChange={setSendVibeOpen} />
    </>
  );
}
