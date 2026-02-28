import { useVibes, VibeSend } from '@/hooks/useVibes';
import { CollapsibleWidget } from './CollapsibleWidget';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Zap, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function ReceivedVibes() {
  const { receivedVibes, markAsRead, loading, unreadCount } = useVibes();

  if (loading || receivedVibes.length === 0) return null;

  return (
    <CollapsibleWidget
      title={`Incoming Vibes${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
      icon={<Zap className="h-4 w-4 text-primary" />}
    >
      <div className="space-y-2">
        <AnimatePresence>
          {receivedVibes.slice(0, 5).map((vibe) => (
            <VibeCard key={vibe.id} vibe={vibe} onMarkRead={markAsRead} />
          ))}
        </AnimatePresence>
      </div>
    </CollapsibleWidget>
  );
}

function VibeCard({ vibe, onMarkRead }: { vibe: VibeSend; onMarkRead: (id: string) => void }) {
  const config = VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social;
  const vibeColors: Record<string, string> = {
    social: 'hsl(var(--vibe-social))',
    chill: 'hsl(var(--vibe-chill))',
    athletic: 'hsl(var(--vibe-athletic))',
    productive: 'hsl(var(--vibe-productive))',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "rounded-xl border p-3 transition-all",
        vibe.is_read
          ? "border-border bg-card/50"
          : "border-primary/20 bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Sender avatar or vibe icon */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${vibeColors[vibe.vibe_type] || vibeColors.social}20` }}
        >
          {config.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{vibe.sender_name}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
              style={{ backgroundColor: vibeColors[vibe.vibe_type] || vibeColors.social }}
            >
              {config.label}
            </span>
          </div>

          {vibe.message && (
            <p className="text-sm text-foreground mt-0.5 line-clamp-2">{vibe.message}</p>
          )}

          {vibe.media_url && (
            <img
              src={vibe.media_url}
              alt="Vibe media"
              className="mt-1.5 h-20 w-20 rounded-lg object-cover border border-border"
            />
          )}

          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
            </span>
            {!vibe.is_read && vibe.recipient_entry_id && (
              <button
                onClick={() => onMarkRead(vibe.recipient_entry_id!)}
                className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
              >
                <Eye className="h-3 w-3" />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
