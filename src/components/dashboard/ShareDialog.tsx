import { useState, useEffect } from 'react';
import { MessageSquare, Image, Copy, Check, Eye, ExternalLink } from 'lucide-react';
import { CalendarShareIcon } from '@/components/ui/CalendarShareIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ShareDialogProps {
  trigger?: React.ReactNode;
}

type ViewDuration = '1w' | '1m' | '3m';

const VIEW_DURATION_OPTIONS: { value: ViewDuration; label: string }[] = [
  { value: '1w', label: '1 Week' },
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
];

export function ShareDialog({ trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [viewDuration, setViewDuration] = useState<ViewDuration>('1w');
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch the user's share code
  useEffect(() => {
    const fetchShareCode = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('share_code')
        .eq('user_id', user.id)
        .single();
      
      if (data?.share_code) {
        setShareCode(data.share_code);
      }
    };

    fetchShareCode();
  }, [user]);

  // Share URL - always use the primary domain for a clean, user-friendly link
  const PRIMARY_DOMAIN = 'https://helloparade.app';
  const shareUrl = shareCode ? `${PRIMARY_DOMAIN}/share/${shareCode}?view=${viewDuration}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Dashboard link has been copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleShareViaText = async () => {
    const shareMessage = `Check out my availability on Parade! ${shareUrl}`;
    const shareData = {
      title: 'Check out my availability on Parade!',
      text: 'See when I\'m free and let\'s make plans!',
      url: shareUrl,
    };

    const canUseWebShare = 
      typeof navigator !== 'undefined' && 
      navigator.share && 
      navigator.canShare && 
      navigator.canShare(shareData);

    if (canUseWebShare) {
      try {
        await navigator.share(shareData);
        toast({
          title: 'Shared!',
          description: 'Your availability has been shared.',
        });
        setOpen(false);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        console.log('Web Share failed, falling back to SMS:', err);
      }
    }

    const smsBody = encodeURIComponent(shareMessage);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const smsUrl = isIOS ? `sms:&body=${smsBody}` : `sms:?body=${smsBody}`;
    
    window.location.href = smsUrl;
    toast({
      title: 'Opening messages',
      description: 'Compose your message to share.',
    });
  };

  const handleShareScreenshot = async () => {
    setIsCapturing(true);
    setOpen(false);
    await new Promise((r) => setTimeout(r, 400));
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const target = document.querySelector('main');
      if (!target) {
        throw new Error('Could not find content to capture');
      }

      const canvas = await html2canvas(target as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create image'));
        }, 'image/png');
      });

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        toast({
          title: 'Screenshot copied! 📋',
          description: 'Paste it into your messaging app to share.',
        });
      } catch (clipErr) {
        console.warn('Clipboard write failed, falling back to download:', clipErr);
        downloadImage(blob);
      }
    } catch (err) {
      console.error('Screenshot error:', err);
      if ((err as Error).name !== 'AbortError') {
        toast({
          title: 'Screenshot failed',
          description: 'Could not capture screenshot. Try sharing the link instead.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadImage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-availability.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Screenshot saved!',
      description: 'Your availability screenshot has been downloaded.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 h-8">
            <CalendarShareIcon className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="left-4 right-4 w-auto max-w-none -translate-x-0 p-0 sm:left-[50%] sm:right-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:p-0 overflow-hidden max-h-[85dvh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0">
          <DialogTitle className="font-display text-lg sm:text-xl">Share Your Availability</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose how much of your schedule to share.
            </p>

            {/* View Duration Picker */}
            <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
              {VIEW_DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setViewDuration(option.value)}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                    viewDuration === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            {/* Preview Profile */}
            {shareCode && (
              <Link
                to={`/share/${shareCode}?view=${viewDuration}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-2.5 text-left transition-all hover:bg-primary/10 hover:border-primary/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm truncate">Preview Your Profile</h3>
                  <p className="text-xs text-muted-foreground truncate">See what friends will see</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Share options</span>
              </div>
            </div>
            
            {/* Share via Text Message */}
            <button
              onClick={handleShareViaText}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:bg-muted/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">Share via Text</h3>
                <p className="text-xs text-muted-foreground truncate">Send a link to friends</p>
              </div>
            </button>
            
            {/* Share Screenshot */}
            <button
              onClick={handleShareScreenshot}
              disabled={isCapturing}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:bg-muted/50 disabled:opacity-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                <Image className="h-4 w-4 text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">
                  {isCapturing ? 'Capturing...' : 'Share Screenshot'}
                </h3>
                <p className="text-xs text-muted-foreground truncate">Capture and share an image</p>
              </div>
            </button>
            
            {/* Copy Link */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or copy link</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0 h-9 w-9"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-availability-available" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
