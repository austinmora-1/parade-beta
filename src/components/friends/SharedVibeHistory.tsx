import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Zap, ChevronDown, Send, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedImage } from '@/components/ui/SignedImage';

interface SharedVibe {
  id: string;
  vibe_type: string;
  custom_tags: string[];
  message: string | null;
  media_url: string | null;
  location_name: string | null;
  created_at: string;
  direction: 'sent' | 'received';
}

const vibeColors: Record<string, string> = {
  social: 'hsl(var(--vibe-social))',
  chill: 'hsl(var(--vibe-chill))',
  athletic: 'hsl(var(--vibe-athletic))',
  productive: 'hsl(var(--vibe-productive))',
  custom: 'hsl(var(--primary))',
};

export function SharedVibeHistory({ friendUserId }: { friendUserId: string }) {
  const { user } = useAuth();
  const [vibes, setVibes] = useState<SharedVibe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !friendUserId) return;

    const load = async () => {
      setLoading(true);

      // Vibes I sent to this friend
      const { data: sentRecipients } = await supabase
        .from('vibe_send_recipients')
        .select('vibe_send_id')
        .eq('recipient_id', friendUserId);

      const sentVibeIds = (sentRecipients || []).map(r => r.vibe_send_id);

      let sentVibes: SharedVibe[] = [];
      if (sentVibeIds.length > 0) {
        const { data: sentData } = await supabase
          .from('vibe_sends')
          .select('*')
          .in('id', sentVibeIds)
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        sentVibes = (sentData || []).map(v => ({
          id: v.id,
          vibe_type: v.vibe_type,
          custom_tags: v.custom_tags || [],
          message: v.message,
          media_url: v.media_url,
          location_name: v.location_name,
          created_at: v.created_at,
          direction: 'sent' as const,
        }));
      }

      // Vibes this friend sent to me
      const { data: receivedRecipients } = await supabase
        .from('vibe_send_recipients')
        .select('vibe_send_id')
        .eq('recipient_id', user.id);

      const receivedVibeIds = (receivedRecipients || []).map(r => r.vibe_send_id);

      let receivedVibes: SharedVibe[] = [];
      if (receivedVibeIds.length > 0) {
        const { data: receivedData } = await supabase
          .from('vibe_sends')
          .select('*')
          .in('id', receivedVibeIds)
          .eq('sender_id', friendUserId)
          .order('created_at', { ascending: false });

        receivedVibes = (receivedData || []).map(v => ({
          id: v.id,
          vibe_type: v.vibe_type,
          custom_tags: v.custom_tags || [],
          message: v.message,
          media_url: v.media_url,
          location_name: v.location_name,
          created_at: v.created_at,
          direction: 'received' as const,
        }));
      }

      const all = [...sentVibes, ...receivedVibes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setVibes(all);
      setLoading(false);
    };

    load();
  }, [user, friendUserId]);

  if (loading || vibes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center justify-between p-4 md:p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-semibold md:text-lg">
            Vibe History
          </h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {vibes.length}
          </span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform shrink-0",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-2">
              {vibes.map(vibe => {
                const isCustom = vibe.vibe_type === 'custom';
                const config = isCustom
                  ? { label: 'Custom', icon: '✨' }
                  : (VIBE_CONFIG[vibe.vibe_type as VibeType] || VIBE_CONFIG.social);

                return (
                  <div
                    key={vibe.id}
                    className="rounded-xl border border-border bg-card/50 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ backgroundColor: `${vibeColors[vibe.vibe_type] || vibeColors.social}20` }}
                      >
                        <config.icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] font-medium rounded-full px-1.5 py-0.5",
                            vibe.direction === 'sent'
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {vibe.direction === 'sent' ? <Send className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                            {vibe.direction === 'sent' ? 'Sent' : 'Received'}
                          </span>
                          {isCustom && vibe.custom_tags.length > 0 ? (
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
                        </div>

                        {vibe.message && (
                          <p className="text-sm text-foreground mt-0.5 line-clamp-2">{vibe.message}</p>
                        )}

                        {vibe.media_url && (
                          <SignedImage src={vibe.media_url} alt="Vibe media" className="mt-1.5 h-16 w-16 rounded-lg object-cover border border-border" />
                        )}

                        {vibe.location_name && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-2.5 w-2.5 text-primary shrink-0" />
                            <span className="text-[11px] text-muted-foreground truncate">{vibe.location_name}</span>
                          </div>
                        )}

                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          {formatDistanceToNow(new Date(vibe.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
