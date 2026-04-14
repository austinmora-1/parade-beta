import { NavLink, useLocation } from 'react-router-dom';
import {
  House,
  CalendarDays,
  Users,
  PlaneTakeoff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';

const navItems = [
  { path: '/',             icon: House,         label: 'Home'    },
  { path: '/availability', icon: CalendarDays,  label: 'Plans'   },
  { path: '/trips',        icon: PlaneTakeoff,  label: 'Trips'   },
  { path: '/friends',      icon: Users,         label: 'Friends' },
];

export function MobileNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/availability') return location.pathname.startsWith('/availability') || location.pathname.startsWith('/plans');
    if (path === '/trips') return location.pathname.startsWith('/trips') || location.pathname.startsWith('/trip/');
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar pb-safe md:hidden">
      <div className="flex items-end justify-around px-1 py-2.5">
        <LayoutGroup>
          {navItems.map((item) => {
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
        </LayoutGroup>
      </div>
    </nav>
  );
}
