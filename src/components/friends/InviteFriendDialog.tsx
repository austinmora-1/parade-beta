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
import { Mail, Copy, Check } from 'lucide-react';

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { addFriend } = usePlannerStore();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const inviteLink = 'https://parade.app/invite/abc123';

  const handleSendInvite = () => {
    if (!email.trim()) return;

    addFriend({
      name: email.split('@')[0],
      email: email,
      status: 'invited',
    });

    toast({
      title: 'Invitation sent!',
      description: `We've sent an invite to ${email}`,
    });

    setEmail('');
    onOpenChange(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Invite Friends</DialogTitle>
          <DialogDescription>
            Invite friends to connect and share plans together
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Invite */}
          <div className="space-y-3">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite by Email
            </Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="friend@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
              />
              <Button onClick={handleSendInvite} disabled={!email.trim()}>
                Send
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Share Link */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Share Invite Link
            </Label>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="bg-muted/50" />
              <Button variant="outline" onClick={handleCopyLink}>
                {copied ? (
                  <Check className="h-4 w-4" />
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
