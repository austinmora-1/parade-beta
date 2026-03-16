import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isSameDay, formatDistanceToNow, isPast } from 'date-fns';
import { usePlannerStore } from '@/stores/plannerStore';
import { useVibes, VibeSend } from '@/hooks/useVibes';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { ACTIVITY_CONFIG, VIBE_CONFIG, VibeType, TIME_SLOT_LABELS, FeedVisibility } from '@/types/planner';
import { getPlanDisplayTitle } from '@/lib/planTitle';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Users, Zap, CalendarCheck, Camera, Globe, Lock, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePods } from '@/hooks/usePods';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { ParticipantsList } from '@/components/plans/ParticipantsList';
import { SignedImage } from '@/components/ui/SignedImage';
import { VibeReactions, VibeReaction } from '@/components/vibes/VibeReactions';
import { VibeDetailDialog } from '@/components/vibes/VibeDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { getSignedUrl } from '@/lib/storage';
import { getElephantAvatar } from '@/lib/elephantAvatars';

type FeedItem =
  | { type: 'vibe'; data: VibeSend; timestamp: Date }
  | { type: 'plan'; data: any; timestamp: Date };

function formatTime12(time: string, showSuffix = true): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  const suffix = showSuffix ? ampm : '';
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${m.toString().padStart(2, '0')}${suffix}`;
}

function formatTimeRange(start: string, end?: string): string {
  if (!end) return formatTime12(start);
  const startH = parseInt(start.split(':')[0], 10);
  const endH = parseInt(end.split(':')[0], 10);
  const samePeriod = (startH >= 12) === (endH >= 12);
  return `${formatTime12(start, !samePeriod)} – ${formatTime12(end)}`;
}

export function FeedView() {
  const { user } = useAuth();
  const { profile: currentUserProfile } = useCurrentUserProfile();
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
  const [friendPublicPlans, setFriendPublicPlans] = useState<any[]>([]);

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

  // Fetch friends' public plans AND plans user participates in - full history
  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    (async () => {
      // 1) Friends' shared plans (past, non-private, not owned by user)
      const { data: sharedData } = await supabase
        .from('plans')
        .select('*')
        .neq('feed_visibility', 'private')
        .neq('user_id', user.id)
        .lt('date', now.toISOString())
        .order('date', { ascending: false })
        .limit(100);

      // 2) Plans user participates in (not their own)
      const { data: participatedPlanIds } = await supabase
        .from('plan_participants')
        .select('plan_id')
        .eq('friend_id', user.id);

      let participatedPlans: any[] = [];
      if (participatedPlanIds && participatedPlanIds.length > 0) {
        const ids = participatedPlanIds.map(p => p.plan_id);
        const { data: pPlans } = await supabase
          .from('plans')
          .select('*')
          .in('id', ids)
          .neq('user_id', user.id)
          .lt('date', now.toISOString())
          .order('date', { ascending: false })
          .limit(100);
        participatedPlans = pPlans || [];
      }

      // Merge and dedupe
      const allPlans = [...(sharedData || []), ...participatedPlans];
      const seen = new Set<string>();
      const deduped = allPlans.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      // Fetch participant info for these plans
      const planIds = deduped.map(p => p.id);
      let participantsMap: Record<string, any[]> = {};
      if (planIds.length > 0) {
        const { data: pData } = await supabase
          .from('plan_participants')
          .select('plan_id, friend_id, status, role')
          .in('plan_id', planIds);
        for (const pp of (pData || [])) {
          if (!participantsMap[pp.plan_id]) participantsMap[pp.plan_id] = [];
          participantsMap[pp.plan_id].push(pp);
        }
      }

      // Fetch owner + participant profiles
      const ownerIds = [...new Set(deduped.map(p => p.user_id))];
      const allUserIds = new Set([...ownerIds]);
      for (const pps of Object.values(participantsMap)) {
        for (const pp of pps) allUserIds.add(pp.friend_id);
      }
      
      let profilesMap: Record<string, { name: string; avatar?: string }> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', Array.from(allUserIds));
        for (const p of (profiles || [])) {
          if (p.user_id) {
            profilesMap[p.user_id] = { name: p.display_name || 'Friend', avatar: p.avatar_url || undefined };
          }
        }
      }

      const mapped = deduped.map(p => {
        const planDate = new Date(p.date);
        const pps = (participantsMap[p.id] || []).filter((pp: any) => pp.friend_id !== user.id);
        const ownerProfile = profilesMap[p.user_id];
        return {
          id: p.id,
          userId: p.user_id,
          ownerName: ownerProfile?.name || 'Someone',
          ownerAvatar: ownerProfile?.avatar,
          title: p.title,
          activity: p.activity,
          date: new Date(planDate.getUTCFullYear(), planDate.getUTCMonth(), planDate.getUTCDate()),
          endDate: p.end_date ? (() => { const ed = new Date(p.end_date); return new Date(ed.getUTCFullYear(), ed.getUTCMonth(), ed.getUTCDate()); })() : undefined,
          timeSlot: p.time_slot,
          duration: p.duration,
          startTime: p.start_time || undefined,
          endTime: p.end_time || undefined,
          location: p.location ? { id: p.id, name: p.location, address: '' } : undefined,
          notes: p.notes || undefined,
          status: p.status,
          feedVisibility: p.feed_visibility || 'private',
          participants: [
            { id: p.user_id, name: ownerProfile?.name || 'Someone', avatar: ownerProfile?.avatar, friendUserId: p.user_id, status: 'connected', role: 'participant' },
            ...pps.map((pp: any) => ({
              id: pp.friend_id,
              name: profilesMap[pp.friend_id]?.name || 'Friend',
              avatar: profilesMap[pp.friend_id]?.avatar,
              friendUserId: pp.friend_id,
              status: 'connected',
              role: pp.role || 'participant',
            })),
          ],
        };
      });
      setFriendPublicPlans(mapped);
    })();
  }, [user?.id]);

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
        data: { ...vibe, sender_name: 'You', sender_avatar: currentUserProfile?.avatar_url || undefined },
        timestamp: new Date(vibe.created_at),
      });
    });

    // Add user's own past plans (all history, not just 7 days)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    plans.forEach((plan) => {
      const planDate = new Date(plan.date);
      if (planDate < todayStart && plan.participants && plan.participants.length > 0) {
        items.push({
          type: 'plan',
          data: plan,
          timestamp: planDate,
        });
      }
    });

    // Add friends' past public plans
    const ownPlanIds = new Set(plans.map(p => p.id));
    friendPublicPlans.forEach((plan) => {
      if (ownPlanIds.has(plan.id)) return;
      items.push({
        type: 'plan',
        data: plan,
        timestamp: new Date(plan.date),
      });
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return items;
  }, [receivedVibes, sentVibes, plans, friendPublicPlans]);

  // Fetch plan photos for feed plans
  const [planPhotos, setPlanPhotos] = useState<Record<string, string[]>>({});
  const feedPlanIds = useMemo(() => feedItems.filter(i => i.type === 'plan').map(i => (i.data as any).id), [feedItems]);

  useEffect(() => {
    if (feedPlanIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('plan_photos')
        .select('plan_id, file_path')
        .in('plan_id', feedPlanIds)
        .order('created_at', { ascending: false });
      if (!data || data.length === 0) return;

      // Group by plan_id and resolve signed URLs
      const grouped: Record<string, string[]> = {};
      for (const p of data) {
        if (!grouped[p.plan_id]) grouped[p.plan_id] = [];
        grouped[p.plan_id].push(p.file_path);
      }

      const resolved: Record<string, string[]> = {};
      for (const [planId, paths] of Object.entries(grouped)) {
        const urls = await Promise.all(
          paths.slice(0, 4).map(fp => {
            if (fp.startsWith('storage:')) {
              const parts = fp.split(':');
              return getSignedUrl(parts[1], parts.slice(2).join(':'));
            }
            return getSignedUrl('plan-photos', fp);
          })
        );
        resolved[planId] = urls;
      }
      setPlanPhotos(resolved);
    })();
  }, [feedPlanIds.join(',')]);

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
          Send a vibe or make a plan to get started!
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
                  photos={planPhotos[(item.data as any).id] || []}
                  currentUserId={currentUserId}
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
        {/* Sender avatar */}
        <div className="h-10 w-10 shrink-0 rounded-full ring-1 ring-border overflow-hidden">
          <img
            src={vibe.sender_avatar || getElephantAvatar(vibe.sender_name || 'User')}
            alt={vibe.sender_name || ''}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: Name + Timestamp */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold truncate">{vibe.sender_name}</span>
              <Zap className="h-3 w-3 text-primary shrink-0" />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Row 2: Vibe badge + tags */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 ? (
              vibe.custom_tags.map((tag) => (
                <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/15">
                  #{tag}
                </span>
              ))
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
                style={{ backgroundColor: vibeColors[vibe.vibe_type] || vibeColors.social }}
              >
                {config.label}
              </span>
            )}
            {!isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 && (
              vibe.custom_tags.map(tag => (
                <span key={tag} className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                  #{tag}
                </span>
              ))
            )}
          </div>

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
  photos,
  currentUserId,
}: {
  plan: any;
  onClick: () => void;
  photos: string[];
  currentUserId: string;
}) {
  const activityConfig = ACTIVITY_CONFIG[plan.activity] || { label: 'Activity', icon: '✨', color: 'activity-misc' };
  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot];
  const displayTitle = getPlanDisplayTitle(plan);
  const planIsPast = isPast(plan.endDate || plan.date) && !isSameDay(plan.endDate || plan.date, new Date());
  const hasPhotos = photos.length > 0;
  const isOwner = plan.userId === currentUserId;
  const { updatePlan } = usePlannerStore();
  const { pods } = usePods();
  const [visPopoverOpen, setVisPopoverOpen] = useState(false);

  const currentVisibility = plan.feedVisibility || 'private';

  const visibilityLabel = currentVisibility === 'private'
    ? { icon: <Lock className="h-3 w-3" />, text: 'Private' }
    : currentVisibility === 'friends'
    ? { icon: <Globe className="h-3 w-3" />, text: 'Friends' }
    : currentVisibility.startsWith('pod:')
    ? { icon: <Users className="h-3 w-3" />, text: pods.find(p => `pod:${p.id}` === currentVisibility)?.name || 'Pod' }
    : { icon: <Lock className="h-3 w-3" />, text: 'Private' };

  const handleVisibilityChange = async (value: string) => {
    await updatePlan(plan.id, { feedVisibility: value as FeedVisibility });
    plan.feedVisibility = value; // optimistic update on local object
    setVisPopoverOpen(false);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border cursor-pointer transition-all hover:shadow-md active:scale-[0.98] overflow-hidden",
        planIsPast
          ? "border-border bg-muted/30"
          : "border-primary/15 bg-card/50"
      )}
    >
      {/* Photo banner */}
      {hasPhotos && (
        <div className={cn(
          "w-full relative overflow-hidden",
          photos.length === 1 && "h-48",
          photos.length === 2 && "h-40 grid grid-cols-2 gap-0.5",
          photos.length === 3 && "h-40 grid grid-cols-3 gap-0.5",
          photos.length >= 4 && "h-56 grid grid-cols-2 grid-rows-2 gap-0.5"
        )}>
          {photos.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt="Plan photo"
              className="w-full h-full object-cover min-h-0"
            />
          ))}
          {photos.length > 4 && (
            <div className="absolute bottom-2 right-2 rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-xs font-medium text-foreground flex items-center gap-1">
              <Camera className="h-3 w-3" />
              +{photos.length - 4}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
        {/* Activity icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
        >
          <ActivityIcon config={activityConfig} size={16} />
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

          {/* Time & Participants */}
          <div className="flex items-center justify-between mt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {plan.startTime
                ? formatTimeRange(plan.startTime, plan.endTime)
                : timeSlotConfig.time}
            </span>
            {plan.participants.filter((p: any) => p.role !== 'subscriber').length > 0 && (
              <div className="flex items-center -space-x-1.5" onClick={e => e.stopPropagation()}>
                {plan.participants
                  .filter((p: any) => p.role !== 'subscriber')
                  .slice(0, 4)
                  .map((p: any, i: number) => (
                    <div key={p.id || i} className="h-5 w-5 rounded-full ring-1 ring-background overflow-hidden shrink-0">
                      <img
                        src={p.avatar || getElephantAvatar(p.name)}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                {plan.participants.filter((p: any) => p.role !== 'subscriber').length > 4 && (
                  <span className="text-[10px] text-muted-foreground ml-1.5">
                    +{plan.participants.filter((p: any) => p.role !== 'subscriber').length - 4}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <CalendarCheck className="h-3 w-3" />
            {plan.endDate
              ? `${format(plan.date, 'MMM d')} – ${format(plan.endDate, 'MMM d')}`
              : format(plan.date, 'EEE, MMM d')}
          </div>

          {/* Location */}
          {plan.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{plan.location.name}</span>
            </div>
          )}
        </div>
        </div>

        {/* Bottom row: Visibility toggle */}
        {isOwner && (
          <div className="mt-2.5 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
            <Popover open={visPopoverOpen} onOpenChange={setVisPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors">
                  {visibilityLabel.icon}
                  <span>{visibilityLabel.text}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" side="top" align="start" sideOffset={4}>
                <button
                  onClick={() => handleVisibilityChange('private')}
                  className={cn("flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs hover:bg-muted transition-colors", currentVisibility === 'private' && "bg-muted font-medium")}
                >
                  <Lock className="h-3.5 w-3.5" /> Private
                </button>
                <button
                  onClick={() => handleVisibilityChange('friends')}
                  className={cn("flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs hover:bg-muted transition-colors", currentVisibility === 'friends' && "bg-muted font-medium")}
                >
                  <Globe className="h-3.5 w-3.5" /> All Friends
                </button>
                {pods.map(pod => (
                  <button
                    key={pod.id}
                    onClick={() => handleVisibilityChange(`pod:${pod.id}`)}
                    className={cn("flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs hover:bg-muted transition-colors", currentVisibility === `pod:${pod.id}` && "bg-muted font-medium")}
                  >
                    <span>{pod.emoji}</span> {pod.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
}
