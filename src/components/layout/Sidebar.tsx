import { NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  Clock, 
  Bell,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { useConversations } from '@/hooks/useChat';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plans', icon: Calendar, label: 'Plans' },
  { path: '/availability', icon: Clock, label: 'Availability' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/interact', icon: MessageCircle, label: 'Interact' },
];

export function Sidebar() {
  const location = useLocation();
  const { totalNotifications } = useNotifications();
  const { conversations } = useConversations();
  const totalUnreadDMs = conversations.filter(c => c.unread_count > 0).length;

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border bg-sidebar md:block">
      <div className="flex h-full flex-col">
        {/* Top Bar: Wordmark centered with icons on right */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <div className="flex-1" />
          <ParadeWordmark size="lg" />
          <div className="flex-1 flex justify-end gap-1">
            <NavLink
              to="/notifications"
              className={cn(
                "relative flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                location.pathname === '/notifications'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Bell className="h-4 w-4" />
              {totalNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {totalNotifications}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/settings"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                location.pathname === '/settings'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          </div>
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
                {item.path === '/friends' && totalUnreadDMs > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {totalUnreadDMs > 9 ? '9+' : totalUnreadDMs}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
