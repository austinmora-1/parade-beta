import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePlannerStore } from '@/stores/plannerStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Copy, Check, Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { addFriend } = usePlannerStore();
  const { toast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const inviteLink = `https://helloparade.app/invite?ref=${encodeURIComponent(inviterName)}`;

  const handleSendInvite = async () => {
    if (!email.trim() && !phone.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

      if (email.trim()) {
        // Send email invite via edge function
        const { error } = await supabase.functions.invoke('send-friend-invite', {
          body: { email: email.trim(), inviterName },
        });
        if (error) throw error;
      }

      addFriend({
        name: email ? email.split('@')[0] : phone.trim(),
        email: email.trim() || undefined,
        status: 'invited',
      });

      toast({
        title: 'Invitation sent! 🎉',
        description: email ? `We've sent an invite to ${email}` : `Invite recorded for ${phone}`,
      });

      setEmail('');
      setPhone('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Failed to send invite',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: 'Link copied!',
      description: 'Share this link with your friends',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-0">
          <DialogTitle className="font-display text-base">Invite Friends</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Email */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="friend@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <Button onClick={handleSendInvite} disabled={(!email.trim() && !phone.trim()) || isSending} size="sm" className="w-full h-8 text-xs">
            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send Invite'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Share Link */}
          <div className="flex gap-1.5">
            <Input value={inviteLink} readOnly className="h-8 bg-muted/50 text-xs flex-1" />
            <Button variant="outline" onClick={handleCopyLink} size="sm" className="h-8 px-2.5 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
