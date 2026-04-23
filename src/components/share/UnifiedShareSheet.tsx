import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link2, CalendarDays, Sparkles, Eye, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS } from '@/types/planner';
import { useOpenInvites } from '@/hooks/useOpenInvites';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Copy,
  Check,
  Loader2,
  MessageSquare,
  Mail,
  Send,
  Share2,
} from 'lucide-react';

const PRIMARY_DOMAIN = 'https://helloparade.app';

interface UnifiedShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional plan to enable plan-specific tabs. */
  planId?: string;
  planTitle?: string;
  /** Which tab to show first. */
  defaultTab?: 'link' | 'profile' | 'open';
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0
    ? `${hour12}${ampm}`
    : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

interface ShareChannel {
  key: string;
  label: string;
  href: (link: string, message: string, subject: string) => string;
  tile: string;
  icon: (cn: string) => JSX.Element;
}

const CHANNELS: ShareChannel[] = [
  {
    key: 'sms',
    label: 'Messages',
    href: (link, message) =>
      `sms:?&body=${encodeURIComponent(`${message} ${link}`)}`,
    tile: 'bg-[hsl(142_70%_45%)] text-white',
    icon: (cn) => <MessageSquare className={cn} />,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: (link, message) =>
      `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`,
    tile: 'bg-[hsl(142_70%_40%)] text-white',
    icon: (cn) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cn}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    key: 'telegram',
    label: 'Telegram',
    href: (link, message) =>
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`,
    tile: 'bg-[hsl(200_90%_50%)] text-white',
    icon: (cn) => <Send className={cn} />,
  },
  {
    key: 'email',
    label: 'Email',
    href: (link, message, subject) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\n${link}`)}`,
    tile: 'bg-[hsl(0_75%_55%)] text-white',
    icon: (cn) => <Mail className={cn} />,
  },
];

/* ---------- Sub-component: link share grid ---------- */
function ShareGrid({
  link,
  loading,
  shareMessage,
  emailSubject,
  title,
}: {
  link: string | null;
  loading: boolean;
  shareMessage: string;
  emailSubject: string;
  title: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Paste it anywhere to share.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareMessage, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      handleCopy();
    }
  };

  const openChannel = (c: ShareChannel) => {
    if (!link) return;
    window.open(c.href(link, shareMessage, emailSubject), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => openChannel(c)}
            disabled={!link}
            className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-transform active:scale-95"
          >
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm ${c.tile}`}
            >
              {c.icon('h-5 w-5')}
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {c.label}
            </span>
          </button>
        ))}
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!link}
            className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-transform active:scale-95"
          >
            <div className="h-12 w-12 rounded-full flex items-center justify-center shadow-sm bg-muted text-foreground">
              <Share2 className="h-5 w-5" />
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight">
              More
            </span>
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={loading ? 'Generating link…' : link ?? ''}
          readOnly
          className="h-9 bg-muted/50 text-xs flex-1"
        />
        <Button
          variant="default"
          onClick={handleCopy}
          disabled={!link}
          size="sm"
          className="h-9 px-3 shrink-0 gap-1.5 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Tab: Plan Invite Link ---------- */
function PlanInviteTab({ planId, planTitle }: { planId: string; planTitle: string }) {
  const { user } = useAuth();
  const plans = usePlannerStore((s) => s.plans);
  const plan = plans.find((p) => p.id === planId);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

  const planDate = plan ? format(plan.date, 'EEE, MMM d') : '';
  const planTime = plan
    ? plan.startTime
      ? `${formatTime12(plan.startTime)}${plan.endTime ? `–${formatTime12(plan.endTime)}` : ''}`
      : TIME_SLOT_LABELS[plan.timeSlot]?.time || ''
    : '';
  const whenLine = [planDate, planTime].filter(Boolean).join(' · ');
  const shareMessage = whenLine
    ? `${inviterName} invited you to "${planTitle}" on ${whenLine}. Join on Parade:`
    : `${inviterName} invited you to "${planTitle}" on Parade:`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from('plan_invites')
      .insert({ plan_id: planId, invited_by: user!.id })
      .select('invite_token')
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoading(false);
          return;
        }
        setLink(`${PRIMARY_DOMAIN}/invite.html?t=${data.invite_token}`);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId, user]);

  return (
    <ShareGrid
      link={link}
      loading={loading}
      shareMessage={shareMessage}
      emailSubject={`Join me for "${planTitle}" on Parade`}
      title={planTitle}
    />
  );
}

/* ---------- Tab: Profile / Availability Share ---------- */
type ViewDuration = '1w' | '1m' | '3m';
const VIEW_DURATION_OPTIONS: { value: ViewDuration; label: string }[] = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
];

function ProfileShareTab({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [viewDuration, setViewDuration] = useState<ViewDuration>('3m');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('share_code')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.share_code) setShareCode(data.share_code);
      });
  }, [user]);

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const link = shareCode
    ? `${PRIMARY_DOMAIN}/share/${shareCode}?view=${viewDuration}`
    : null;
  const shareMessage = `${inviterName} shared their availability on Parade. Tap to see when they're free:`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {VIEW_DURATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setViewDuration(option.value)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
              viewDuration === option.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {shareCode && (
        <Link
          to={`/share/${shareCode}?view=${viewDuration}`}
          onClick={onClose}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-2.5 text-left transition-all hover:bg-primary/10 hover:border-primary/50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm truncate">Preview Your Profile</h3>
            <p className="text-xs text-muted-foreground truncate">
              See what friends will see
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Link>
      )}
      <ShareGrid
        link={link}
        loading={!shareCode}
        shareMessage={shareMessage}
        emailSubject={`${inviterName} shared their Parade availability`}
        title="My availability"
      />
    </div>
  );
}

/* ---------- Tab: Open invite (broadcast) ---------- */
function OpenInviteTab({
  planId,
  planTitle,
  onClose,
}: {
  planId: string;
  planTitle: string;
  onClose: () => void;
}) {
  const plans = usePlannerStore((s) => s.plans);
  const plan = plans.find((p) => p.id === planId);
  const { create } = useOpenInvites();
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBroadcast = async () => {
    if (!plan) return;
    setSubmitting(true);
    const dateStr = format(plan.date, 'yyyy-MM-dd');
    const created = await create({
      title: planTitle,
      activity: plan.activity || 'other-events',
      date: dateStr,
      time_slot: plan.timeSlot,
      start_time: plan.startTime ?? null,
      end_time: plan.endTime ?? null,
      duration: plan.duration ?? 60,
      location: plan.location?.name ?? null,
      notes: notes || null,
      audience_type: 'all_friends',
    });
    setSubmitting(false);
    if (created) {
      toast({
        title: 'Open invite sent!',
        description: 'Friends will be notified — first to claim joins the plan.',
      });
      onClose();
    } else {
      toast({
        title: 'Could not broadcast',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          Open invite
        </div>
        Broadcast this plan to all your friends. The first to claim joins —
        you'll get notified.
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add a note (optional)…"
        rows={3}
        className="text-sm resize-none"
      />
      <Button
        className="w-full"
        onClick={handleBroadcast}
        disabled={submitting || !plan}
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Broadcast to friends
          </>
        )}
      </Button>
    </div>
  );
}

/* ---------- Main component ---------- */
export function UnifiedShareSheet({
  open,
  onOpenChange,
  planId,
  planTitle,
  defaultTab,
}: UnifiedShareSheetProps) {
  const isPlan = Boolean(planId && planTitle);
  const initialTab = defaultTab ?? (isPlan ? 'link' : 'profile');
  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const headerTitle = isPlan ? `Share "${planTitle}"` : 'Share';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-0">
          <DialogTitle className="font-display text-base truncate">
            {headerTitle}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="pt-2">
          <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${isPlan ? 3 : 1}, minmax(0, 1fr))` }}>
            {isPlan && (
              <TabsTrigger value="link" className="text-xs gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Link
              </TabsTrigger>
            )}
            <TabsTrigger value="profile" className="text-xs gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Availability
            </TabsTrigger>
            {isPlan && (
              <TabsTrigger value="open" className="text-xs gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Open
              </TabsTrigger>
            )}
          </TabsList>

          {isPlan && (
            <TabsContent value="link" className="pt-4">
              <PlanInviteTab planId={planId!} planTitle={planTitle!} />
            </TabsContent>
          )}

          <TabsContent value="profile" className="pt-4">
            <ProfileShareTab onClose={() => onOpenChange(false)} />
          </TabsContent>

          {isPlan && (
            <TabsContent value="open" className="pt-4">
              <OpenInviteTab
                planId={planId!}
                planTitle={planTitle!}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default UnifiedShareSheet;
