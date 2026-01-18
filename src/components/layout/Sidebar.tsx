import { NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  Clock, 
  Settings,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import paradeLogo from '@/assets/parade-logo.png';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plans', icon: Calendar, label: 'Plans' },
  { path: '/availability', icon: Clock, label: 'Availability' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/chat', icon: MessageCircle, label: 'Chat with Elly' },
];

export function Sidebar() {
  const location = useLocation();
  const { totalNotifications } = useNotifications();
  const { profile } = useCurrentUserProfile();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border bg-sidebar md:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <img src={paradeLogo} alt="Parade" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-xl font-bold text-foreground">Parade</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.path === '/chat' && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground/20 text-xs">
                    ✨
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section: Notifications & Settings */}
        <div className="border-t border-sidebar-border p-4 space-y-1">
          <NavLink
            to="/notifications"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 relative",
              location.pathname === '/notifications'
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Bell className="h-5 w-5" />
            Notifications
            {totalNotifications > 0 && (
              <span className={cn(
                "ml-auto flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold",
                location.pathname === '/notifications'
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-primary text-primary-foreground"
              )}>
                {totalNotifications}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              location.pathname === '/settings'
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            Settings
          </NavLink>
          <NavLink
            to="/profile"
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              location.pathname === '/profile'
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Avatar className="h-5 w-5">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
              <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                {getInitials(profile?.display_name)}
              </AvatarFallback>
            </Avatar>
            Profile
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
