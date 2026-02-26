import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FriendLinkProps {
  userId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps any content (avatar, name, etc.) in a clickable link to /friend/:userId.
 * If no userId is provided, renders children without navigation.
 */
export function FriendLink({ userId, children, className }: FriendLinkProps) {
  const navigate = useNavigate();

  if (!userId) {
    return <>{children}</>;
  }

  return (
    <span
      role="link"
      tabIndex={0}
      data-stop-card-click
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/friend/${userId}`);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          navigate(`/friend/${userId}`);
        }
      }}
      className={cn("cursor-pointer hover:opacity-80 transition-opacity", className)}
    >
      {children}
    </span>
  );
}
