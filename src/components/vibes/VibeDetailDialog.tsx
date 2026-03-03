import { useState, useEffect } from 'react';
import { VibeSend } from '@/hooks/useVibes';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Clock, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { VibeComments } from './VibeComments';
import { motion } from 'framer-motion';
import { SignedImage } from '@/components/ui/SignedImage';
import { VibeReactions, VibeReaction } from './VibeReactions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

function VibeRecipientNames({ vibeSendId, currentUserId, senderId }: { vibeSendId: string; currentUserId?: string; senderId?: string }) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isSentByMe = currentUserId && senderId && currentUserId === senderId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_vibe_recipient_names', {
        p_vibe_send_id: vibeSendId,
      });

      if (cancelled) return;

      if (error) {
        console.error('Error fetching vibe recipients:', error);
        setLoading(false);
        return;
      }

      if (isSentByMe) {
        // For sent vibes, show all recipients
        const allNames = (data || []).map((r: any) => r.display_name || 'Someone');
        setNames(allNames);
      } else {
        // For received vibes, exclude current user
        const otherNames = (data || [])
          .filter((r: any) => r.user_id !== currentUserId)
          .map((r: any) => r.display_name || 'Someone');
        setNames(otherNames);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [vibeSendId, currentUserId, isSentByMe]);

  if (loading || names.length === 0) return null;

  let displayNames: string;
  if (names.length <= 2) {
    displayNames = names.join(', ');
  } else {
    const extra = names.length - 2;
    displayNames = `${names.slice(0, 2).join(', ')}`;
    displayNames += ` +${extra} friend${extra > 1 ? 's' : ''}`;
  }

  const label = isSentByMe ? 'Sent to' : 'Also sent to';

  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">
        {label} <span className="font-medium text-foreground">{displayNames}</span>
      </span>
    </div>
  );
}

interface VibeDetailDialogProps {
  vibe: VibeSend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: (id: string) => void;
  reactions?: VibeReaction[];
  currentUserId?: string;
  onToggleReaction?: (vibeSendId: string, emoji: string) => void;
}

const vibeColors: Record<string, string> = {
  social: 'hsl(var(--vibe-social))',
  chill: 'hsl(var(--vibe-chill))',
  athletic: 'hsl(var(--vibe-athletic))',
  productive: 'hsl(var(--vibe-productive))',
  custom: 'hsl(var(--primary))',
};

export function VibeDetailDialog({ vibe, open, onOpenChange, onDismiss, reactions, currentUserId, onToggleReaction }: VibeDetailDialogProps) {
  if (!vibe) return null;

  const isCustom = vibe.vibe_type === 'custom';
  const config = isCustom
    ? { label: 'Custom', icon: '✨', color: 'primary', description: 'Custom vibe' }
    : (VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social);

  const bgColor = vibeColors[vibe.vibe_type] || vibeColors.social;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto sm:rounded-2xl overflow-hidden p-0 max-h-[85vh] flex flex-col">
        {/* Colored header band */}
        <div
          className="relative px-5 pt-6 pb-4 shrink-0"
          style={{ background: `linear-gradient(135deg, ${bgColor}22, ${bgColor}08)` }}
        >
          <DialogHeader className="space-y-0">
            <DialogTitle className="sr-only">Vibe from {vibe.sender_name}</DialogTitle>
            <DialogDescription className="sr-only">Details of a vibe sent by {vibe.sender_name}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
              {vibe.sender_avatar ? (
                <AvatarImage src={vibe.sender_avatar} alt={vibe.sender_name} />
              ) : null}
              <AvatarFallback className="text-lg" style={{ backgroundColor: `${bgColor}30` }}>
                {config.icon}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h3 className="font-display text-base font-semibold truncate">{vibe.sender_name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vibe.custom_tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium text-primary bg-primary/15"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary-foreground"
                    style={{ backgroundColor: bgColor }}
                  >
                    {config.icon} {config.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content body */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-5 pb-5 space-y-4">
            {/* Non-custom vibes with extra custom tags */}
            {!isCustom && vibe.custom_tags && vibe.custom_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {vibe.custom_tags.map(tag => (
                  <span key={tag} className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Message */}
            {vibe.message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-foreground leading-relaxed"
              >
                {vibe.message}
              </motion.p>
            )}

            {/* Photo */}
            {vibe.media_url && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="overflow-hidden rounded-xl border border-border"
              >
                <SignedImage
                  src={vibe.media_url}
                  alt="Vibe media"
                  className="w-full max-h-64 object-cover"
                />
              </motion.div>
            )}

            {/* Location */}
            {vibe.location_name && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vibe.location_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 hover:bg-muted transition-colors group"
              >
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate group-hover:underline">{vibe.location_name}</span>
              </a>
            )}

            {/* Reactions */}
            {reactions && currentUserId && onToggleReaction && vibe && (
              <VibeReactions
                vibeSendId={vibe.id}
                reactions={reactions}
                currentUserId={currentUserId}
                onToggleReaction={onToggleReaction}
              />
            )}

            {/* Other recipients */}
            <VibeRecipientNames vibeSendId={vibe.id} currentUserId={currentUserId} senderId={vibe.sender_id} />

            {/* Timestamp */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(new Date(vibe.created_at), 'MMM d, yyyy · h:mm a')}</span>
              <span className="text-muted-foreground/60">
                ({formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })})
              </span>
            </div>

            {/* Comments */}
            <VibeComments vibeSendId={vibe.id} />

            {/* Dismiss action */}
            {vibe.recipient_entry_id && onDismiss && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => onDismiss(vibe.recipient_entry_id!)}
              >
                <X className="h-3.5 w-3.5" />
                Dismiss vibe
              </Button>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
