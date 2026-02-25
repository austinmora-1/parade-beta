import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MessageCircle, 
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/availability', icon: Clock, label: 'Availability' },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/20 bg-[hsl(150_35%_30%)] pb-safe md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-200",
                isActive
                  ? "text-white"
                  : "text-primary-foreground/60"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                isActive && "bg-white/20"
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
        
        {/* Profile link with avatar */}
        <NavLink
          to="/profile"
          className="relative flex flex-col items-center justify-center rounded-xl px-3 py-2 transition-all duration-200"
        >
          <Avatar className={cn(
            "h-8 w-8 transition-all",
            isProfileActive && "ring-2 ring-white ring-offset-2 ring-offset-primary"
          )}>
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'Profile'} />
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {getInitials(profile?.display_name)}
            </AvatarFallback>
          </Avatar>
        </NavLink>
      </div>
    </nav>
  );
}
