import { useEffect, useState, useCallback } from 'react';
import { UserPlus, Copy, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PlaceholderInvite {
  id: string;
  invite_token: string;
  placeholder_name: string;
  status: string;
}

interface Props {
  planId: string;
  isOwner: boolean;
}

/**
 * Lists pending plan_invites that have a placeholder_name (i.e. invites
 * created for friends who weren't on Parade yet). Each row shows a
 * Copy-link button so the inviter can share the unique claim URL via
 * any channel (iMessage, WhatsApp, email, etc.).
 *
 * When the recipient signs up and claims the invite, the placeholder is
 * automatically replaced by their real participant record (handled by
 * the accept_plan_invite RPC), and the invite drops out of this list.
 */
export function PendingPlaceholderInvites({ planId, isOwner }: Props) {
  const [invites, setInvites] = useState<PlaceholderInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plan_invites')
      .select('id, invite_token, placeholder_name, status')
      .eq('plan_id', planId)
      .eq('status', 'pending')
      .not('placeholder_name', 'is', null);
    if (error) {
      console.error('[PendingPlaceholderInvites] load error', error);
    } else {
      setInvites((data || []) as PlaceholderInvite[]);
    }
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading pending invites…
      </div>
    );
  }

  if (invites.length === 0) return null;

  const buildLink = (token: string) =>
    `${window.location.origin}/plan-invite/${token}`;

  const handleCopy = async (inv: PlaceholderInvite) => {
    const link = buildLink(inv.invite_token);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(inv.id);
      toast.success(`Link for ${inv.placeholder_name} copied`);
      setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async (inv: PlaceholderInvite) => {
    const link = buildLink(inv.invite_token);
    const text = `Join me on Parade — I added you to a plan: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Parade', text, url: link });
        return;
      } catch {
        // User cancelled or share failed — fall back to copy
      }
    }
    handleCopy(inv);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pending invites · not on Parade
        </div>
        <span className="text-[10px] text-muted-foreground">{invites.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{inv.placeholder_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  Waiting to claim invite
                </p>
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleCopy(inv)}
                  title="Copy invite link"
                >
                  {copiedId === inv.id ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => handleShare(inv)}
                >
                  Share
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PendingPlaceholderInvites;
