import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartNudges } from '@/hooks/useSmartNudges';
import { useLastHungOut } from '@/hooks/useLastHungOut';
import { usePlannerStore } from '@/stores/plannerStore';
import { Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { SignedImage } from '@/components/ui/SignedImage';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { QuickPlanSheet } from '@/components/plans/QuickPlanSheet';

export function SmartNudges() {
  const { nudges, dismissNudge, markActedOn } = useSmartNudges();
  const { friends } = usePlannerStore();
  const navigate = useNavigate();
  const [quickPlanFriend, setQuickPlanFriend] = useState<{ userId: string; name: string; avatar?: string } | null>(null);

  const friendUserIds = useMemo(
    () => nudges.map(n => n.friend_user_id).filter((id): id is string => !!id),
    [nudges]
  );

  const lastDates = useLastHungOut(friendUserIds);

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

  const handleSuggestPlan = (nudge: typeof nudges[0]) => {
    const friend = nudge.friend_user_id ? friendMap[nudge.friend_user_id] : null;
    if (!friend || !nudge.friend_user_id) return;
    setQuickPlanFriend({ userId: nudge.friend_user_id, name: friend.name, avatar: friend.avatar });
  };

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
        <AnimatePresence mode="popLayout">
          {nudges.slice(0, 5).map((nudge) => (
            <SwipeableNudgeCard
              key={nudge.id}
              nudge={nudge}
              friendMap={friendMap}
              getLastHungLabel={getLastHungLabel}
              onAction={handleAction}
              onDismiss={dismissNudge}
              onSuggestPlan={handleSuggestPlan}
            />
          ))}
        </AnimatePresence>
      </div>

      <QuickPlanSheet
        open={!!quickPlanFriend}
        onOpenChange={(open) => { if (!open) setQuickPlanFriend(null); }}
        preSelectedFriend={quickPlanFriend || undefined}
      />
    </div>
  );
}

function SwipeableNudgeCard({
  nudge,
  friendMap,
  getLastHungLabel,
  onAction,
  onDismiss,
  onSuggestPlan,
}: {
  nudge: { id: string; friend_user_id: string | null; title: string };
  friendMap: Record<string, { name: string; avatar?: string }>;
  getLastHungLabel: (id: string | null) => string | null;
  onAction: (nudge: any) => void;
  onDismiss: (id: string) => void;
  onSuggestPlan: (nudge: any) => void;
}) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-60, -30, 0], [0, 0.5, 1]);

  const friend = nudge.friend_user_id ? friendMap[nudge.friend_user_id] : null;
  const name = friend?.name || nudge.title;
  const lastHung = getLastHungLabel(nudge.friend_user_id);

  return (
    <motion.div
      layout
      initial={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      style={{ y, opacity }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -50) {
          onDismiss(nudge.id);
        }
      }}
      onClick={() => onAction(nudge)}
      className="relative flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 transition-colors cursor-pointer group hover:border-primary/20 hover:shadow-soft min-w-[80px] w-[80px] shrink-0 touch-pan-x select-none"
    >
      <div className="h-10 w-10 rounded-full ring-1 ring-border overflow-hidden shrink-0 pointer-events-none">
        {friend?.avatar ? (
          <SignedImage
            src={friend.avatar}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getElephantAvatar(name); }}
          />
        ) : (
          <img
            src={getElephantAvatar(name)}
            alt={name}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <p className="text-[11px] font-medium text-center leading-tight truncate w-full pointer-events-none">
        {friend?.name?.split(' ')[0] || name}
      </p>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onSuggestPlan(nudge);
        }}
        className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
      >
        Suggest a plan →
      </button>

    </motion.div>
  );
}
