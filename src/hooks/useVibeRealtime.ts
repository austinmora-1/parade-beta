import { useRealtimeHub } from './useRealtimeHub';
import { useAuth } from './useAuth';
import { useVibeStore } from '@/stores/vibeStore';

/**
 * Subscribes to the current user's profile row and applies any remote vibe
 * changes directly to the vibe store. Mount once at the app shell.
 */
export function useVibeRealtime() {
  const { user } = useAuth();
  const filter = user ? `user_id=eq.${user.id}` : undefined;

  useRealtimeHub(
    'profiles',
    'UPDATE',
    (payload: any) => {
      if (!payload?.new) return;
      useVibeStore.getState().applyRealtimeUpdate(payload.new);
    },
    filter,
  );
}
