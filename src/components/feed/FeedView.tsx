import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isSameDay, formatDistanceToNow, isPast, subDays } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { useVibes, VibeSend } from '@/hooks/useVibes';
import { useAuth } from '@/hooks/useAuth';
import { ACTIVITY_CONFIG, VIBE_CONFIG, VibeType, TIME_SLOT_LABELS } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Users, Zap, CalendarCheck, MessageCircle } from 'lucide-react';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { ParticipantsList } from '@/components/plans/ParticipantsList';
import { SignedImage } from '@/components/ui/SignedImage';
import { VibeReactions, VibeReaction } from '@/components/vibes/VibeReactions';
import { VibeDetailDialog } from '@/components/vibes/VibeDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

type FeedItem =
  | { type: 'vibe'; data: VibeSend; timestamp: Date }
  | { type: 'plan'; data: any; timestamp: Date };

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function FeedView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { plans } = usePlannerStore();
  const {
    receivedVibes,
    sentVibes,
    vibeReactions,
    sentVibeReactions,
    commentCounts,
    loading: vibesLoading,
    dismissVibe,
    toggleVibeReaction,
    markAsRead,
  } = useVibes();
  const currentUserId = user?.id || '';
  const [selectedVibe, setSelectedVibe] = useState<VibeSend | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link handling for vibes from push notifications
  useEffect(() => {
    const vibeId = searchParams.get('vibe');
    if (!vibeId || !user) return;

    searchParams.delete('vibe');
    setSearchParams(searchParams, { replace: true });

    (async () => {
      try {
        const { data: vibeData } = await supabase
          .from('vibe_sends')
          .select('*')
          .eq('id', vibeId)
          .single();

        if (!vibeData) return;

        const { data: profile } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .eq('user_id', vibeData.sender_id)
          .single();

        const { data: recipientEntry } = await supabase
          .from('vibe_send_recipients')
          .select('id, read_at')
          .eq('vibe_send_id', vibeId)
          .eq('recipient_id', user.id)
          .maybeSingle();

        const vibe: VibeSend = {
          ...vibeData,
          custom_tags: vibeData.custom_tags || [],
          sender_name: profile?.display_name || 'Someone',
          sender_avatar: profile?.avatar_url || undefined,
          is_read: !!recipientEntry?.read_at,
          recipient_entry_id: recipientEntry?.id,
        };

        setSelectedVibe(vibe);
        if (recipientEntry?.id && !recipientEntry.read_at) {
          markAsRead(recipientEntry.id);
        }
      } catch (err) {
        console.error('Error loading deep-linked vibe:', err);
      }
    })();
  }, [user, searchParams]);

  // Merge vibes and recent plans into a chronological feed
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Add received vibes
    receivedVibes.forEach((vibe) => {
      items.push({
        type: 'vibe',
        data: vibe,
        timestamp: new Date(vibe.created_at),
      });
    });

    // Add sent vibes
    sentVibes.forEach((vibe) => {
      items.push({
        type: 'vibe',
        data: { ...vibe, sender_name: 'You' },
        timestamp: new Date(vibe.created_at),
      });
    });

    // Add only past plans (already happened)
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    plans.forEach((plan) => {
      const planDate = new Date(plan.date);
      if (planDate >= sevenDaysAgo && planDate < now) {
        items.push({
          type: 'plan',
          data: plan,
          timestamp: planDate,
        });
      }
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return items;
  }, [receivedVibes, sentVibes, plans]);

  const allReactions = [...vibeReactions, ...sentVibeReactions];

  if (vibesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground animate-pulse">Loading feed...</p>
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 text-4xl">🎪</div>
        <p className="text-muted-foreground font-medium">Your feed is empty</p>
        <p className="text-sm text-muted-foreground mt-1">
          Send a vibe or create a plan to get started!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {feedItems.map((item, idx) => (
            <motion.div
              key={item.type === 'vibe' ? `vibe-${item.data.id}` : `plan-${(item.data as any).id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
            >
              {item.type === 'vibe' ? (
                <VibeFeedCard
                  vibe={item.data as VibeSend}
                  onTap={() => setSelectedVibe(item.data as VibeSend)}
                  reactions={allReactions}
                  currentUserId={currentUserId}
                  onToggleReaction={toggleVibeReaction}
                  commentCount={commentCounts[(item.data as VibeSend).id] || 0}
                />
              ) : (
                <PlanFeedCard
                  plan={item.data as any}
                  onClick={() => navigate(`/plan/${(item.data as any).id}`)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <VibeDetailDialog
        vibe={selectedVibe}
        open={!!selectedVibe}
        onOpenChange={(open) => { if (!open) setSelectedVibe(null); }}
        onDismiss={(id) => { dismissVibe(id); setSelectedVibe(null); }}
        reactions={allReactions}
        currentUserId={currentUserId}
        onToggleReaction={toggleVibeReaction}
      />
    </>
  );
}

// --- Vibe Feed Card ---
function VibeFeedCard({
  vibe,
  onTap,
  reactions,
  currentUserId,
  onToggleReaction,
  commentCount,
}: {
  vibe: VibeSend;
  onTap: () => void;
  reactions: VibeReaction[];
  currentUserId: string;
  onToggleReaction: (vibeSendId: string, emoji: string) => void;
  commentCount: number;
}) {
  const isCustom = vibe.vibe_type === 'custom';
  const config = isCustom
    ? { label: 'Custom', icon: '✨', color: 'primary', description: 'Custom vibe' }
    : (VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social);
  const vibeColors: Record<string, string> = {
    social: 'hsl(var(--vibe-social))',
    chill: 'hsl(var(--vibe-chill))',
    athletic: 'hsl(var(--vibe-athletic))',
    productive: 'hsl(var(--vibe-productive))',
    custom: 'hsl(var(--primary))',
  };

  const isSent = vibe.sender_name === 'You';

  return (
    <div
      onClick={onTap}
      className={cn(
        "rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.98]",
        vibe.is_read === false
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-card/50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Vibe icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${vibeColors[vibe.vibe_type] || vibeColors.social}20` }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold truncate">{vibe.sender_name}</span>
              <Zap className="h-3 w-3 text-primary shrink-0" />
              {isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 ? (
                vibe.custom_tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/15">
                    #{tag}
                  </span>
                ))
              ) : (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                  style={{ backgroundColor: vibeColors[vibe.vibe_type] || vibeColors.social }}
                >
                  {config.label}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Tags for non-custom with custom tags */}
          {!isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {vibe.custom_tags.map(tag => (
                <span key={tag} className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Message */}
          {vibe.message && (
            <p className="text-sm text-foreground mt-1 line-clamp-3">{vibe.message}</p>
          )}

          {/* Media */}
          {vibe.media_url && (
            <SignedImage
              src={vibe.media_url}
              alt="Vibe media"
              className="mt-2 max-h-48 w-full rounded-xl object-cover border border-border"
            />
          )}

          {/* Location */}
          {vibe.location_name && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vibe.location_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 mt-1.5 group/loc"
            >
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate group-hover/loc:text-primary group-hover/loc:underline transition-colors">
                {vibe.location_name}
              </span>
            </a>
          )}

          {/* Reactions */}
          <VibeReactions
            vibeSendId={vibe.id}
            reactions={reactions}
            currentUserId={currentUserId}
            onToggleReaction={onToggleReaction}
            commentCount={commentCount}
          />
        </div>
      </div>
    </div>
  );
}

// --- Plan Feed Card ---
function PlanFeedCard({
  plan,
  onClick,
}: {
  plan: any;
  onClick: () => void;
}) {
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc' };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
  const displayTitle = getPlanDisplayTitle(plan);
  const planIsPast = isPast(plan.endDate || plan.date) && !isSameDay(plan.endDate || plan.date, new Date());

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.98]",
        planIsPast
          ? "border-border bg-muted/30"
          : "border-primary/15 bg-card/50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Activity icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={20} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">{displayTitle}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {isSameDay(plan.date, new Date()) && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Today
                </span>
              )}
              {planIsPast && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Past
                </span>
              )}
            </div>
          </div>

          {/* Time & Date */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {plan.startTime
                ? formatTime12(plan.startTime) + (plan.endTime ? ` – ${formatTime12(plan.endTime)}` : '')
                : timeSlotConfig.time}
            </span>
            <span className="flex items-center gap-1">
              <CalendarCheck className="h-3 w-3" />
              {plan.endDate
                ? `${format(plan.date, 'MMM d')} – ${format(plan.endDate, 'MMM d')}`
                : format(plan.date, 'EEE, MMM d')}
            </span>
          </div>

          {/* Location */}
          {plan.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{plan.location.name}</span>
            </div>
          )}

          {/* Participants */}
          {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5" onClick={e => e.stopPropagation()}>
              <Users className="h-3 w-3 shrink-0" />
              <ParticipantsList participants={plan.participants.filter(p => p.role !== 'subscriber')} compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
