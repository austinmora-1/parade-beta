import { useAuth } from '@/hooks/useAuth';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { user } = useAuth();

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const inviteLink = `https://helloparade.app/invite.html?ref=${encodeURIComponent(inviterName)}&from=${user?.id || ''}`;

  return (
    <ShareLinkDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Join me on Parade"
      shareMessage={`${inviterName} invited you to Parade — let's hang out IRL more often.`}
      emailSubject={`${inviterName} invited you to Parade`}
      generateLink={async () => inviteLink}
    />
  );
}

export default InviteFriendDialog;
