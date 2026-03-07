import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartNudges } from '@/hooks/useSmartNudges';
import { useLastHungOut } from '@/hooks/useLastHungOut';
import { usePlannerStore } from '@/stores/plannerStore';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { SignedImage } from '@/components/ui/SignedImage';

export function SmartNudges() {
  const { nudges, dismissNudge, markActedOn } = useSmartNudges();
  const { friends } = usePlannerStore();
  const navigate = useNavigate();

  // Get friend user IDs from nudges
  const friendUserIds = useMemo(
    () => nudges.map(n => n.friend_user_id).filter((id): id is string => !!id),
    [nudges]
  );

  const lastDates = useLastHungOut(friendUserIds);

  // Build a lookup from friendUserId -> friend data
  const friendMap = useMemo(() => {
    const map: Record<string, { name: string; avatar?: string }> = {};
    for (const f of friends) {
      if (f.friendUserId) {
        map[f.friendUserId] = { name: f.name, avatar: f.avatar };
      }
    }
    return map;
  }, [friends]);

  if (nudges.length === 0) return null;

  const handleAction = (nudge: typeof nudges[0]) => {
    markActedOn(nudge.id);
    if (nudge.friend_user_id) {
      navigate(`/friend/${nudge.friend_user_id}`);
    } else {
      navigate('/friends');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getLastHungLabel = (friendUserId: string | null) => {
    if (!friendUserId) return null;
    const d = lastDates[friendUserId];
    if (!d) return 'Never hung out';
    return formatDistanceToNow(d, { addSuffix: true });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Suggested</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {nudges.slice(0, 5).map((nudge) => {
          const friend = nudge.friend_user_id ? friendMap[nudge.friend_user_id] : null;
          const name = friend?.name || nudge.title;
          const lastHung = getLastHungLabel(nudge.friend_user_id);

          return (
            <div
              key={nudge.id}
              className="relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 transition-all cursor-pointer group hover:border-primary/20 hover:shadow-soft min-w-[80px] w-[80px] shrink-0"
              onClick={() => handleAction(nudge)}
            >
              <button
                className="absolute top-1 right-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNudge(nudge.id);
                }}
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>

              <div className="h-10 w-10 rounded-full ring-1 ring-border overflow-hidden shrink-0">
                {friend?.avatar ? (
                  <SignedImage
                    path={friend.avatar}
                    alt={name}
                    className="h-full w-full object-cover"
                    fallbackSrc={getElephantAvatar(name)}
                  />
                ) : (
                  <img
                    src={getElephantAvatar(name)}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <p className="text-[11px] font-medium text-center leading-tight truncate w-full">
                {friend?.name?.split(' ')[0] || name}
              </p>

              {lastHung && (
                <p className="text-[10px] text-muted-foreground text-center leading-tight">
                  {lastHung}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
