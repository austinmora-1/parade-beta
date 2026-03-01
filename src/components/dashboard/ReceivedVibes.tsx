import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useVibes, VibeSend } from '@/hooks/useVibes';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import { CollapsibleWidget } from './CollapsibleWidget';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Zap, X, MapPin, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { VibeDetailDialog } from '@/components/vibes/VibeDetailDialog';
import { SignedImage } from '@/components/ui/SignedImage';
import { VibeReactions, VibeReaction } from '@/components/vibes/VibeReactions';

export function ReceivedVibes() {
  const { receivedVibes, dismissVibe, loading, unreadCount, vibeReactions, toggleVibeReaction, commentCounts, markAsRead } = useVibes();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = user?.id || '';
  const [selectedVibe, setSelectedVibe] = useState<VibeSend | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  // Fast-path: fetch specific vibe directly from DB for push notification deep links
  // This runs immediately without waiting for the full vibes list to load
  useEffect(() => {
    const vibeId = searchParams.get('vibe');
    if (!vibeId || !user || deepLinkHandled) return;

    setDeepLinkHandled(true);
    // Clear the param immediately so it doesn't re-trigger
    searchParams.delete('vibe');
    setSearchParams(searchParams, { replace: true });

    // Fetch this specific vibe directly - much faster than waiting for full list
    (async () => {
      try {
        const { data: vibeData } = await supabase
          .from('vibe_sends')
          .select('*')
          .eq('id', vibeId)
          .single();

        if (!vibeData) return;

        // Get sender profile
        const { data: profile } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url')
          .eq('user_id', vibeData.sender_id)
          .single();

        // Get recipient entry for read status
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

        // Mark as read
        if (recipientEntry?.id && !recipientEntry.read_at) {
          markAsRead(recipientEntry.id);
        }
      } catch (err) {
        console.error('Error loading deep-linked vibe:', err);
      }
    })();
  }, [user, searchParams]);

  if (loading) return null;

  const displayedVibes = showAll ? receivedVibes : receivedVibes.slice(0, 5);
  const hasMore = receivedVibes.length > 5;

  return (
    <>
      <CollapsibleWidget
        title={`Incoming Vibes${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        icon={<Zap className="h-4 w-4 text-primary" />}
      >
        {receivedVibes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No incoming vibes yet — send one to a friend to get things started!</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {displayedVibes.map((vibe) => (
                <VibeCard
                  key={vibe.id}
                  vibe={vibe}
                  onDismiss={dismissVibe}
                  onTap={() => setSelectedVibe(vibe)}
                  reactions={vibeReactions}
                  currentUserId={currentUserId}
                  onToggleReaction={toggleVibeReaction}
                  commentCount={commentCounts[vibe.id] || 0}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
        {hasMore && (
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="w-full text-center text-xs font-medium text-primary hover:underline py-1"
          >
            {showAll ? 'Show less' : `View all ${receivedVibes.length} vibes`}
          </button>
        )}
      </CollapsibleWidget>

      <VibeDetailDialog
        vibe={selectedVibe}
        open={!!selectedVibe}
        onOpenChange={(open) => { if (!open) setSelectedVibe(null); }}
        onDismiss={(id) => { dismissVibe(id); setSelectedVibe(null); }}
        reactions={vibeReactions}
        currentUserId={currentUserId}
        onToggleReaction={toggleVibeReaction}
      />
    </>
  );
}

function VibeCard({ vibe, onDismiss, onTap, reactions, currentUserId, onToggleReaction, commentCount }: { vibe: VibeSend; onDismiss: (id: string) => void; onTap: () => void; reactions: VibeReaction[]; currentUserId: string; onToggleReaction: (vibeSendId: string, emoji: string) => void; commentCount: number }) {
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

  const handleDismiss = () => {
    if (vibe.recipient_entry_id) {
      onDismiss(vibe.recipient_entry_id);
    }
  };

  const x = useMotionValue(0);
  const dismissOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);
  const dismissScale = useTransform(x, [-120, -60, 0], [1, 0.8, 0.5]);
  const cardOpacity = useTransform(x, [-150, -100, 0], [0.4, 0.7, 1]);
  const bgColor = useTransform(x, [-100, 0], ['hsl(var(--destructive) / 0.15)', 'transparent']);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Dismiss indicator behind the card */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4 rounded-xl"
        style={{ backgroundColor: bgColor }}
      >
        <motion.div
          className="flex items-center gap-1.5 text-destructive"
          style={{ opacity: dismissOpacity, scale: dismissScale }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-xs font-semibold">Dismiss</span>
        </motion.div>
      </motion.div>

      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
        style={{ x, opacity: cardOpacity }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_e, info) => {
          if (info.offset.x < -80 || (info.velocity.x < -300 && info.offset.x < -30)) {
            handleDismiss();
          }
        }}
        onClick={onTap}
        className={cn(
          "relative rounded-xl border p-3 cursor-pointer hover:shadow-md active:scale-[0.98] touch-pan-y",
          vibe.is_read
            ? "border-border bg-card/50"
            : "border-primary/20 bg-primary/5"
        )}
      >
        {/* Dismiss X */}
        {vibe.recipient_entry_id && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            className="absolute top-2 right-2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Dismiss vibe"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex items-start gap-3 pr-5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${vibeColors[vibe.vibe_type] || vibeColors.social}20` }}
          >
            {config.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">{vibe.sender_name}</span>
              {isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 ? (
                vibe.custom_tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/15"
                  >
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

            {!isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {vibe.custom_tags.map(tag => (
                  <span key={tag} className="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {vibe.message && (
              <p className="text-sm text-foreground mt-0.5 line-clamp-2">{vibe.message}</p>
            )}

            {vibe.media_url && (
              <SignedImage
                src={vibe.media_url}
                alt="Vibe media"
                className="mt-1.5 h-20 w-20 rounded-lg object-cover border border-border"
              />
            )}

            {vibe.location_name && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vibe.location_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 mt-1 group/loc"
              >
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate group-hover/loc:text-primary group-hover/loc:underline transition-colors">{vibe.location_name}</span>
              </a>
            )}

            <VibeReactions
              vibeSendId={vibe.id}
              reactions={reactions}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              commentCount={commentCount}
            />

            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
