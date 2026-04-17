import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Loader2, MessageSquare, Mail, Send, Share2 } from 'lucide-react';

interface ShareChannel {
  key: string;
  label: string;
  // Returns the URL to open for this channel.
  href: (link: string, message: string, subject: string) => string;
  // Tailwind background + text color classes for the icon tile.
  tile: string;
  // Icon node — accepts className.
  icon: (className: string) => JSX.Element;
}

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title shown in the dialog header (e.g. plan/trip title). */
  title: string;
  /** Pre-built share message body (without the URL — URL is appended). */
  shareMessage: string;
  /** Subject line used for email channels. */
  emailSubject: string;
  /**
   * Called when the dialog opens to mint a fresh shareable link.
   * Should return the public URL to share.
   */
  generateLink: () => Promise<string>;
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
    key: 'messenger',
    label: 'Messenger',
    href: (link) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    tile: 'bg-[hsl(220_90%_55%)] text-white',
    icon: (cn) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cn}>
        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z" />
      </svg>
    ),
  },
  {
    key: 'email',
    label: 'Email',
    href: (link, message, subject) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\n${link}`)}`,
    tile: 'bg-[hsl(0_75%_55%)] text-white',
    icon: (cn) => <Mail className={cn} />,
  },
  {
    key: 'x',
    label: 'X',
    href: (link, message) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`,
    tile: 'bg-foreground text-background',
    icon: (cn) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cn}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export function ShareLinkDialog({
  open,
  onOpenChange,
  title,
  shareMessage,
  emailSubject,
  generateLink,
}: ShareLinkDialogProps) {
  const { toast } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mint a fresh link every time the dialog opens.
  useEffect(() => {
    if (!open) {
      setLink(null);
      setCopied(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    generateLink()
      .then((url) => {
        if (!cancelled) setLink(url);
      })
      .catch((err: any) => {
        if (!cancelled) {
          toast({
            title: 'Failed to generate link',
            description: err?.message ?? 'Please try again',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        // User cancelled — ignore.
      }
    } else {
      handleCopy();
    }
  };

  const openChannel = (channel: ShareChannel) => {
    if (!link) return;
    const url = channel.href(link, shareMessage, emailSubject);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-0">
          <DialogTitle className="font-display text-base">Share "{title}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Channel grid */}
          <div className="grid grid-cols-4 gap-3">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => openChannel(c)}
                disabled={!link}
                className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-transform active:scale-95"
              >
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm ${c.tile}`}>
                  {c.icon('h-5 w-5')}
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">{c.label}</span>
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
                <span className="text-[10px] text-muted-foreground leading-tight">More</span>
              </button>
            )}
          </div>

          {/* Copy link row */}
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
      </DialogContent>
    </Dialog>
  );
}

export default ShareLinkDialog;
