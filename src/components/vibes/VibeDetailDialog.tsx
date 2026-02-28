import { VibeSend } from '@/hooks/useVibes';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

interface VibeDetailDialogProps {
  vibe: VibeSend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: (id: string) => void;
}

const vibeColors: Record<string, string> = {
  social: 'hsl(var(--vibe-social))',
  chill: 'hsl(var(--vibe-chill))',
  athletic: 'hsl(var(--vibe-athletic))',
  productive: 'hsl(var(--vibe-productive))',
  custom: 'hsl(var(--primary))',
};

export function VibeDetailDialog({ vibe, open, onOpenChange, onDismiss }: VibeDetailDialogProps) {
  if (!vibe) return null;

  const isCustom = vibe.vibe_type === 'custom';
  const config = isCustom
    ? { label: 'Custom', icon: '✨', color: 'primary', description: 'Custom vibe' }
    : (VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social);

  const bgColor = vibeColors[vibe.vibe_type] || vibeColors.social;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto sm:rounded-2xl overflow-hidden p-0">
        {/* Colored header band */}
        <div
          className="relative px-5 pt-6 pb-4"
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

        {/* Content body */}
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
              <img
                src={vibe.media_url}
                alt="Vibe media"
                className="w-full max-h-64 object-cover"
              />
            </motion.div>
          )}

          {/* Location */}
          {vibe.location_name && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm text-foreground truncate">{vibe.location_name}</span>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(new Date(vibe.created_at), 'MMM d, yyyy · h:mm a')}</span>
            <span className="text-muted-foreground/60">
              ({formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })})
            </span>
          </div>

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
      </DialogContent>
    </Dialog>
  );
}
