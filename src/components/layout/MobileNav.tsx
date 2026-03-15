import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, MessageCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { motion, LayoutGroup } from 'framer-motion';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/availability', icon: Clock, label: 'Avail' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
];

export function MobileNav() {
  const location = useLocation();
  const { profile } = useCurrentUserProfile();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isProfileActive = location.pathname === '/profile';

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

          {/* Profile */}
          <NavLink
            to="/profile"
            className="flex flex-col items-center gap-0.5 px-3 py-1"
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="h-9 w-9 flex items-center justify-center"
            >
              <Avatar
                className={cn(
                  'h-7 w-7 transition-all duration-200',
                  isProfileActive && 'ring-2 ring-sidebar-primary ring-offset-1 ring-offset-sidebar'
                )}
              >
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
                <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>
            </motion.div>
            <span className={cn(
              'text-[10px] font-medium transition-colors duration-150',
              isProfileActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50'
            )}>
              Me
            </span>
          </NavLink>
        </div>
      </nav>

      <QuickPlanSheet open={quickPlanOpen} onOpenChange={setQuickPlanOpen} />
    </>
  );
}
