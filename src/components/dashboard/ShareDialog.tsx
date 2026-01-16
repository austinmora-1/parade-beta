import { useState, useEffect } from 'react';
import { MessageSquare, Image, Copy, Check, Share2 } from 'lucide-react';
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

interface ShareDialogProps {
  trigger?: React.ReactNode;
}

export function ShareDialog({ trigger }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
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

  // Share URL uses the primary domain
  const shareUrl = shareCode 
    ? `https://helloparade.app/share/${shareCode}` 
    : '';

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
    const shareData = {
      title: 'Check out my availability on Parade!',
      text: 'See when I\'m free and let\'s make plans!',
      url: shareUrl,
    };

    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast({
          title: 'Shared!',
          description: 'Your availability has been shared.',
        });
        setOpen(false);
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== 'AbortError') {
          toast({
            title: 'Share failed',
            description: 'Could not share. Try copying the link instead.',
            variant: 'destructive',
          });
        }
      }
    } else {
      // Fallback for browsers without Web Share API - open SMS with prefilled text
      const smsBody = encodeURIComponent(`Check out my availability on Parade! ${shareUrl}`);
      window.open(`sms:?body=${smsBody}`, '_blank');
      toast({
        title: 'Opening messages',
        description: 'Compose your message to share.',
      });
    }
  };

  const handleShareScreenshot = async () => {
    setIsCapturing(true);
    
    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      // Find the main content area to capture
      const mainContent = document.querySelector('main');
      if (!mainContent) {
        throw new Error('Could not find content to capture');
      }

      const canvas = await html2canvas(mainContent as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create image'));
        }, 'image/png');
      });

      // Try to share the image
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'my-availability.png', { type: 'image/png' });
        const shareData = { files: [file] };
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast({
            title: 'Screenshot shared!',
            description: 'Your availability screenshot has been shared.',
          });
          setOpen(false);
        } else {
          // Fallback: download the image
          downloadImage(blob);
        }
      } else {
        // Fallback: download the image
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
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share Availability</span>
            <span className="sm:hidden">Share</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="left-4 right-4 w-auto max-w-none -translate-x-0 p-4 sm:left-[50%] sm:right-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:p-6 overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-lg sm:text-xl">Share Your Availability</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-3 sm:space-y-4 sm:py-4">
          <p className="text-sm text-muted-foreground">
            Choose how you'd like to share with friends.
          </p>
          
          {/* Share via Text Message */}
          <button
            onClick={handleShareViaText}
            className="flex w-full max-w-full overflow-hidden items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:bg-muted/50 sm:gap-4 sm:p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-12 sm:w-12">
              <MessageSquare className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm sm:text-base truncate">Share via Text</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Send a link to friends</p>
            </div>
          </button>
          
          {/* Share Screenshot */}
          <button
            onClick={handleShareScreenshot}
            disabled={isCapturing}
            className="flex w-full max-w-full overflow-hidden items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:bg-muted/50 disabled:opacity-50 sm:gap-4 sm:p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/10 sm:h-12 sm:w-12">
              <Image className="h-5 w-5 text-secondary sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm sm:text-base truncate">
                {isCapturing ? 'Capturing...' : 'Share Screenshot'}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Capture and share an image</p>
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
            <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs sm:text-sm text-muted-foreground truncate">
              {shareUrl}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
            >
              {copied ? (
                <Check className="h-4 w-4 text-availability-available" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
