import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Mail, Copy, Check, Loader2, Link2, Phone } from 'lucide-react';

interface InviteToTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  tripId?: string | null;
  destination?: string | null;
  proposalType?: 'trip' | 'visit';
}

export function InviteToTripDialog({
  open,
  onOpenChange,
  proposalId,
  tripId,
  destination,
  proposalType = 'trip',
}: InviteToTripDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [displayLink, setDisplayLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const titleLabel = destination
    ? `${proposalType === 'visit' ? 'Visit to' : 'Trip to'} ${destination}`
    : proposalType === 'visit' ? 'a visit' : 'a trip';

  const createInviteAndGetLink = async (toEmail?: string) => {
    const { data, error } = await supabase
      .from('trip_proposal_invites')
      .insert({
        proposal_id: proposalId,
        trip_id: tripId ?? null,
        invited_by: user!.id,
        email: toEmail ?? null,
      })
      .select('invite_token')
      .single();

    if (error) throw error;
    const ogLink = `https://helloparade.app/invite.html?tt=${data.invite_token}`;
    return { ogLink, token: data.invite_token };
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const { ogLink, token } = await createInviteAndGetLink();
      const cleanLink = `https://helloparade.app/trip-invite/${token}`;
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
      const { ogLink } = await createInviteAndGetLink(email.trim().toLowerCase());

      await supabase.functions.invoke('send-trip-invite', {
        body: {
          email: email.trim(),
          inviterName,
          destination: destination || null,
          proposalType,
          inviteUrl: ogLink,
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

  const handleSendSmsInvite = async () => {
    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast({ title: 'Invalid phone number', description: 'Please enter a valid phone number with country code (e.g. +1...)', variant: 'destructive' });
      return;
    }
    setIsSendingSms(true);
    try {
      const { ogLink } = await createInviteAndGetLink();
      const { error } = await supabase.functions.invoke('send-sms-invite', {
        body: {
          phone: cleanPhone,
          inviteUrl: ogLink,
          inviterName,
          planTitle: titleLabel,
        },
      });
      if (error) throw error;
      toast({ title: 'Text sent! 📱', description: `Invite texted to ${phone}` });
      setPhone('');
    } catch (err: any) {
      toast({ title: 'Failed to send text', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingSms(false);
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
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-0">
          <DialogTitle className="font-display text-base">Invite to "{titleLabel}"</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Email */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="friend@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmailInvite()}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <Button
              onClick={handleSendEmailInvite}
              disabled={!email.trim() || isSending}
              size="sm"
              className="h-8 px-3 text-xs shrink-0"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
            </Button>
          </div>

          {/* SMS */}
          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && smsConsent && handleSendSmsInvite()}
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Button
                onClick={handleSendSmsInvite}
                disabled={!phone.trim() || isSendingSms || !smsConsent}
                size="sm"
                className="h-8 px-3 text-xs shrink-0"
              >
                {isSendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Text'}
              </Button>
            </div>
            {phone.trim() && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={smsConsent}
                  onCheckedChange={(v) => setSmsConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-[11px] leading-tight text-muted-foreground">
                  I confirm the recipient has consented to receive this text message. Standard messaging rates may apply.
                </span>
              </label>
            )}
          </div>

          {/* Link */}
          {generatedLink ? (
            <div className="flex gap-1.5">
              <Input value={displayLink || ''} readOnly className="h-8 bg-muted/50 text-xs flex-1" />
              <Button variant="outline" onClick={handleCopyLink} size="sm" className="h-8 px-2.5 shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleGenerateLink}
              disabled={isGeneratingLink}
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
            >
              {isGeneratingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Generate Link
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InviteToTripDialog;
