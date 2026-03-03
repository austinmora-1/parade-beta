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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Mail, Copy, Check, Loader2, Link2 } from 'lucide-react';

interface InviteToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planTitle: string;
}

export function InviteToPlanDialog({ open, onOpenChange, planId, planTitle }: InviteToPlanDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [displayLink, setDisplayLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const { data, error } = await supabase
        .from('plan_invites')
        .insert({
          plan_id: planId,
          invited_by: user!.id,
        })
        .select('invite_token')
        .single();

      if (error) throw error;

      // Static HTML file with OG meta tags for iMessage/social crawlers.
      // Using explicit .html extension ensures hosting serves it as static HTML, not SPA.
      // Crawlers see "You're Invited!" card; users get JS-redirected to /plan-invite/TOKEN.
      const ogLink = `https://helloparade.app/invite.html?t=${data.invite_token}`;
      const cleanLink = `https://helloparade.app/plan-invite/${data.invite_token}`;
      setGeneratedLink(ogLink);
      setDisplayLink(cleanLink);
    } catch (err: any) {
      toast({ title: 'Failed to generate link', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!email.trim()) return;

    setIsSending(true);
    try {
      // Create the invite record with email
      const { data, error } = await supabase
        .from('plan_invites')
        .insert({
          plan_id: planId,
          invited_by: user!.id,
          email: email.trim().toLowerCase(),
        })
        .select('invite_token')
        .single();

      if (error) throw error;

      // Static HTML file with OG tags for rich link previews in email
      const inviteUrl = `https://helloparade.app/invite.html?t=${data.invite_token}`;

      const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

      // Send email via existing edge function
      await supabase.functions.invoke('send-friend-invite', {
        body: {
          email: email.trim(),
          inviterName,
          customSubject: `${inviterName} invited you to "${planTitle}"`,
          customMessage: `You've been invited to join a plan: "${planTitle}". Click below to view the details and join!`,
          customUrl: inviteUrl,
        },
      });

      toast({ title: 'Invite sent! 🎉', description: `Invitation sent to ${email}` });
      setEmail('');
    } catch (err: any) {
      toast({ title: 'Failed to send invite', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Share this link with anyone' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Invite to Plan</DialogTitle>
          <DialogDescription>
            Invite anyone to join "{planTitle}" — even if they don't have an account yet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Invite */}
          <div className="space-y-3">
            <Label htmlFor="invite-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite by Email
            </Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmailInvite()}
              />
            </div>
            <Button
              onClick={handleSendEmailInvite}
              disabled={!email.trim() || isSending}
              className="w-full"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
            </Button>
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
              <Link2 className="h-4 w-4" />
              Share Invite Link
            </Label>
            {generatedLink ? (
              <div className="flex gap-2">
                <Input value={displayLink || ''} readOnly className="bg-muted/50 text-xs" />
                <Button variant="outline" onClick={handleCopyLink} size="icon">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleGenerateLink}
                disabled={isGeneratingLink}
                className="w-full"
              >
                {isGeneratingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Generate Invite Link
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
