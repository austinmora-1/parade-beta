import { supabase } from '@/integrations/supabase/client';

/**
 * Send a push notification to the owner of a vibe when someone reacts or comments.
 * Fire-and-forget — errors are silently ignored.
 */
export async function notifyVibeOwner({
  vibeSendId,
  actorUserId,
  type,
  emoji,
}: {
  vibeSendId: string;
  actorUserId: string;
  type: 'reaction' | 'comment';
  emoji?: string;
}) {
  try {
    // Look up the vibe to find its sender
    const { data: vibe } = await supabase
      .from('vibe_sends')
      .select('sender_id')
      .eq('id', vibeSendId)
      .single();

    if (!vibe || vibe.sender_id === actorUserId) return; // don't notify yourself

    // Get actor's display name
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', actorUserId)
      .single();

    const actorName = actorProfile?.display_name || 'Someone';

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    const title =
      type === 'reaction'
        ? `${actorName} reacted ${emoji || ''} to your vibe`
        : `${actorName} commented on your vibe`;

    const body =
      type === 'reaction'
        ? `Tap to see reactions`
        : `Tap to view the comment`;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/send-push-notification`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: vibe.sender_id,
          title,
          body,
          url: `/?vibe=${vibeSendId}`,
        }),
      }
    ).catch(() => {}); // fire-and-forget
  } catch {
    // non-critical
  }
}
