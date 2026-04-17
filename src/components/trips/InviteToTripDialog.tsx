import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';

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

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const titleLabel = destination
    ? `${proposalType === 'visit' ? 'Visit to' : 'Trip to'} ${destination}`
    : proposalType === 'visit'
      ? 'a visit'
      : 'a trip';

  const shareMessage = `${inviterName} invited you to "${titleLabel}" on Parade. Join in:`;

  const generateLink = async () => {
    const { data, error } = await supabase
      .from('trip_proposal_invites')
      .insert({
        proposal_id: proposalId,
        trip_id: tripId ?? null,
        invited_by: user!.id,
      })
      .select('invite_token')
      .single();
    if (error) throw error;
    return `https://helloparade.app/invite.html?tt=${data.invite_token}`;
  };

  return (
    <ShareLinkDialog
      open={open}
      onOpenChange={onOpenChange}
      title={titleLabel}
      shareMessage={shareMessage}
      emailSubject={`Join me for "${titleLabel}" on Parade`}
      generateLink={generateLink}
    />
  );
}

export default InviteToTripDialog;
