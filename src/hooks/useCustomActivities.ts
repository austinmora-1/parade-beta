import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CustomActivity, VibeType } from '@/types/planner';

/**
 * Loads the current user's saved custom activity categories from
 * profiles.custom_activities, and exposes a helper to add new ones.
 *
 * Custom activities are persisted to the user's profile so they
 * become available across every activity selector in the app.
 */
export function useCustomActivities() {
  const { session } = useAuth();
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('custom_activities')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.custom_activities) {
          setCustomActivities(data.custom_activities as unknown as CustomActivity[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session?.user]);

  const addCustomActivity = useCallback(
    async (input: { label: string; icon: string; vibeType?: VibeType }): Promise<CustomActivity | null> => {
      if (!session?.user || !input.label.trim()) return null;
      const newActivity: CustomActivity = {
        id: `custom-${Date.now()}`,
        label: input.label.trim(),
        icon: input.icon || '✨',
        vibeType: input.vibeType ?? 'social',
      };
      const updated = [...customActivities, newActivity];
      setCustomActivities(updated);
      const { error } = await supabase
        .from('profiles')
        .update({ custom_activities: updated as any })
        .eq('user_id', session.user.id);
      if (error) {
        // revert on failure
        setCustomActivities(customActivities);
        return null;
      }
      return newActivity;
    },
    [session?.user, customActivities]
  );

  const removeCustomActivity = useCallback(
    async (id: string): Promise<boolean> => {
      if (!session?.user) return false;
      const updated = customActivities.filter(a => a.id !== id);
      setCustomActivities(updated);
      const { error } = await supabase
        .from('profiles')
        .update({ custom_activities: updated as any })
        .eq('user_id', session.user.id);
      if (error) {
        setCustomActivities(customActivities);
        return false;
      }
      return true;
    },
    [session?.user, customActivities]
  );

  return { customActivities, addCustomActivity, removeCustomActivity, loading };
}
