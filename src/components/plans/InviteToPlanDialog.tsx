import { UnifiedShareSheet } from '@/components/share/UnifiedShareSheet';

interface InviteToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planTitle: string;
}

export function InviteToPlanDialog({
  open,
  onOpenChange,
  planId,
  planTitle,
}: InviteToPlanDialogProps) {
  return (
    <UnifiedShareSheet
      open={open}
      onOpenChange={onOpenChange}
      planId={planId}
      planTitle={planTitle}
      defaultTab="link"
    />
  );
}

export default InviteToPlanDialog;
