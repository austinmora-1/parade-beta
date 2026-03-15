import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MessageCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import { useConversations } from '@/hooks/useChat';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/availability', icon: Clock, label: 'Avail' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
];

export function MobileNav() {
  const location = useLocation();
  const { conversations } = useConversations();
  const totalUnreadDMs = conversations.filter(c => c.unread_count > 0).length;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar pb-safe md:hidden">
        <div className="flex items-center justify-around px-2 py-1.5">
          <LayoutGroup>
            {navItems.map((item) => {
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
            })}
          </LayoutGroup>
        </div>
      </nav>
    </>
  );
}
