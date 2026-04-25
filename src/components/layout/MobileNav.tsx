import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  House,
  CalendarDays,
  Users,
  PlaneTakeoff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

const navItems = [
  { path: '/',             icon: House,         label: 'Home'    },
  { path: '/availability', icon: CalendarDays,  label: 'Plans'   },
  { path: '/trips',        icon: PlaneTakeoff,  label: 'Trips'   },
  { path: '/friends',      icon: Users,         label: 'Friends' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, formattedName } = useCurrentUserProfile();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/availability') return location.pathname.startsWith('/availability') || location.pathname.startsWith('/plans');
    if (path === '/trips') return location.pathname.startsWith('/trips') || location.pathname.startsWith('/trip/');
    return location.pathname.startsWith(path);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isProfileActive = location.pathname === '/profile' || location.pathname === '/settings';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar pb-safe md:hidden">
      <div className="flex items-center justify-around px-1 py-2.5">
        <LayoutGroup>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-tour={`nav-${item.label.toLowerCase()}`}
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

          {/* Profile avatar tab */}
          <button
            onClick={() => navigate('/profile')}
            className="relative flex flex-col items-center gap-0.5 flex-1 py-0.5"
          >
            <div className="relative flex h-9 w-9 items-center justify-center">
              {isProfileActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl bg-sidebar-accent"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Avatar className={cn('relative h-9 w-9', isProfileActive && 'ring-2 ring-sidebar-primary')}>
                <AvatarImage src={profile?.avatar_url || undefined} alt={formattedName || 'Profile'} />
                <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                  {getInitials(formattedName)}
                </AvatarFallback>
              </Avatar>
            </div>
            
          </button>
        </LayoutGroup>
      </div>
    </nav>
  );
}
