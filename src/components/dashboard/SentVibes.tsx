import { useState } from 'react';
import { useVibes, VibeSend } from '@/hooks/useVibes';
import { CollapsibleWidget } from './CollapsibleWidget';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Send, MapPin, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { VibeReaction } from '@/components/vibes/VibeReactions';

export function SentVibes() {
  const { sentVibes, sentVibeReactions, commentCounts, loading } = useVibes();
  const [expanded, setExpanded] = useState(false);

  if (loading || sentVibes.length === 0) return null;

  const displayVibes = expanded ? sentVibes : sentVibes.slice(0, 3);

  return (
    <CollapsibleWidget
      title="Sent Vibes"
      icon={<Send className="h-4 w-4 text-primary" />}
    >
      <div className="space-y-2">
        <AnimatePresence>
          {displayVibes.map((vibe) => (
            <SentVibeCard key={vibe.id} vibe={vibe} reactions={sentVibeReactions} commentCount={commentCounts[vibe.id] || 0} />
          ))}
        </AnimatePresence>
      </div>
      {sentVibes.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:underline mt-2 block"
        >
          {expanded ? 'Show less' : `Show all ${sentVibes.length} vibes`}
        </button>
      )}
    </CollapsibleWidget>
  );
}

const vibeColors: Record<string, string> = {
  social: 'hsl(var(--vibe-social))',
  chill: 'hsl(var(--vibe-chill))',
  athletic: 'hsl(var(--vibe-athletic))',
  productive: 'hsl(var(--vibe-productive))',
  custom: 'hsl(var(--primary))',
};

function SentVibeCard({ vibe, reactions, commentCount }: { vibe: VibeSend; reactions: VibeReaction[]; commentCount: number }) {
  const isCustom = vibe.vibe_type === 'custom';
  const config = isCustom
    ? { label: 'Custom', icon: '✨', color: 'primary', description: 'Custom vibe' }
    : (VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social);

  const vibeReactions = reactions.filter(r => r.vibe_send_id === vibe.id);

  // Group reactions by emoji
  const grouped = new Map<string, number>();
  vibeReactions.forEach(r => {
    grouped.set(r.emoji, (grouped.get(r.emoji) || 0) + 1);
  });

  const targetLabel = vibe.target_type === 'broadcast' ? 'all friends' : vibe.target_type === 'pod' ? 'pod' : 'selected';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl border border-border bg-card/50 p-3"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: `${vibeColors[vibe.vibe_type] || vibeColors.social}20` }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 ? (
              vibe.custom_tags.map(tag => (
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
            <span className="text-[10px] text-muted-foreground">→ {targetLabel}</span>
          </div>

          {vibe.message && (
            <p className="text-sm text-foreground mt-0.5 line-clamp-2">{vibe.message}</p>
          )}

          {vibe.media_url && (
            <img src={vibe.media_url} alt="Vibe media" className="mt-1.5 h-16 w-16 rounded-lg object-cover border border-border" />
          )}

          {vibe.location_name && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vibe.location_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 mt-1 group/loc"
            >
              <MapPin className="h-2.5 w-2.5 text-primary shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate group-hover/loc:text-primary group-hover/loc:underline transition-colors">{vibe.location_name}</span>
            </a>
          )}

          {/* Comment & Reaction summary */}
          {(commentCount > 0 || vibeReactions.length > 0) && (
            <div className="flex items-center gap-1 mt-1.5">
              {commentCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] border border-border bg-card text-muted-foreground">
                  <MessageCircle className="h-3 w-3" />
                  <span className="font-medium">{commentCount}</span>
                </span>
              )}
              {Array.from(grouped.entries()).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] border border-border bg-card text-muted-foreground"
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="font-medium">{count}</span>}
                </span>
              ))}
              {vibeReactions.length > 0 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {vibeReactions.length} reaction{vibeReactions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          <span className="text-[10px] text-muted-foreground mt-0.5 block">
            {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
