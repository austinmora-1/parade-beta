import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { TIME_SLOT_LABELS } from '@/types/planner';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';

interface InviteToPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planTitle: string;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function InviteToPlanDialog({ open, onOpenChange, planId, planTitle }: InviteToPlanDialogProps) {
  const { user } = useAuth();
  const plans = usePlannerStore((s) => s.plans);
  const plan = plans.find((p) => p.id === planId);

  const inviterName =
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

  const planDate = plan ? format(plan.date, 'EEE, MMM d') : '';
  const planTime = plan
    ? plan.startTime
      ? `${formatTime12(plan.startTime)}${plan.endTime ? `–${formatTime12(plan.endTime)}` : ''}`
      : TIME_SLOT_LABELS[plan.timeSlot]?.time || ''
    : '';

  const whenLine = [planDate, planTime].filter(Boolean).join(' · ');
  const shareMessage = whenLine
    ? `${inviterName} invited you to "${planTitle}" on ${whenLine}. Join on Parade:`
    : `${inviterName} invited you to "${planTitle}" on Parade:`;

  const generateLink = async () => {
    const { data, error } = await supabase
      .from('plan_invites')
      .insert({ plan_id: planId, invited_by: user!.id })
      .select('invite_token')
      .single();
    if (error) throw error;
    return `https://helloparade.app/invite.html?t=${data.invite_token}`;
  };

  return (
    <ShareLinkDialog
      open={open}
      onOpenChange={onOpenChange}
      title={planTitle}
      shareMessage={shareMessage}
      emailSubject={`Join me for "${planTitle}" on Parade`}
      generateLink={generateLink}
    />
  );
}

export default InviteToPlanDialog;
