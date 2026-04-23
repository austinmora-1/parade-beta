import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  Settings,
  PlaneTakeoff,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { OpenInviteSheet } from '@/components/plans/OpenInviteSheet';

const navItems = [
  { path: '/',             icon: LayoutDashboard, label: 'Home'         },
  { path: '/availability', icon: CalendarDays,    label: 'Plans'        },
  { path: '/trips',        icon: PlaneTakeoff,    label: 'Trips'        },
  { path: '/friends',      icon: Users,           label: 'Friends'      },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, formattedName } = useCurrentUserProfile();
  const [openInviteOpen, setOpenInviteOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpenInviteOpen(true);
    window.addEventListener('parade:open-invite-sheet', handler);
    return () => window.removeEventListener('parade:open-invite-sheet', handler);
  }, []);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/availability') return location.pathname.startsWith('/availability') || location.pathname.startsWith('/plans');
    if (path === '/trips') return location.pathname.startsWith('/trips') || location.pathname.startsWith('/trip/');
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar md:flex">

        {/* ── Wordmark ── */}
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-sidebar-border px-4">
          <ParadeWordmark size="lg" />
        </div>

        {/* ── Primary nav ── */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sidebar-primary" />
                )}
                <item.icon
                  className="h-4 w-4 shrink-0"
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </NavLink>
            );
          })}

          {/* Find someone to join me */}
          <button
            onClick={() => setOpenInviteOpen(true)}
            className="group mt-2 flex w-full items-center gap-3 rounded-lg border border-dashed border-sidebar-border px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:border-sidebar-primary/40 hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="flex-1 truncate text-left">Find someone to join me</span>
          </button>
        </nav>

        {/* ── Divider ── */}
        <div className="mx-3 shrink-0 border-t border-sidebar-border" />

        {/* ── Profile + settings row ── */}
        <div className="shrink-0 flex items-center gap-2.5 px-3 py-3">
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-1 items-center gap-2.5 min-w-0 rounded-lg p-1 transition-colors hover:bg-sidebar-accent/50"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} alt={formattedName || 'Profile'} />
              <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                {getInitials(formattedName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-sidebar-foreground leading-tight">
                {formattedName || 'My Profile'}
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-tight">View profile</p>
            </div>
          </button>

          <NavLink
            to="/settings"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
              location.pathname === '/settings'
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
            )}
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </aside>
      <OpenInviteSheet open={openInviteOpen} onOpenChange={setOpenInviteOpen} />
    </>
  );
}
