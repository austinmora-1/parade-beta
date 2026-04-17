import { create } from 'zustand';
import { Vibe, VibeType } from '@/types/planner';
import { supabase } from '@/integrations/supabase/client';
import { patchCachedDashboard } from '@/lib/dashboardCache';

function patchVibeInCache(userId: string, vibe: Vibe | null) {
  patchCachedDashboard(userId, (data: any) => {
    if (!data?.profile) return data;
    return {
      ...data,
      profile: {
        ...data.profile,
        current_vibe: vibe?.type || null,
        vibe_gif_url: vibe?.gifUrl || null,
        custom_vibe_tags: vibe?.customTags || [],
      },
    };
  }).catch(() => {});
}

// Window during which we ignore "stale" remote updates that may overwrite a fresh local mutation.
const LOCAL_MUTATION_GUARD_MS = 10_000;

export interface VibeState {
  currentVibe: Vibe | null;
  userTimezone: string;
  lastLocalMutationAt: number;
}

export interface VibeActions {
  _setVibe: (currentVibe: Vibe | null) => void;
  _setTimezone: (tz: string) => void;
  /** Apply a remote vibe (from RPC/cache). Skipped if a local mutation happened recently. */
  applyRemoteVibe: (currentVibe: Vibe | null) => void;
  setVibe: (vibe: Vibe | null, userId: string) => Promise<void>;
  addCustomVibe: (tag: string, userId: string) => Promise<void>;
  removeCustomVibe: (tag: string, userId: string) => Promise<void>;
}

export const useVibeStore = create<VibeState & VibeActions>((set, get) => ({
  currentVibe: null,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  lastLocalMutationAt: 0,

  _setVibe: (currentVibe) => set({ currentVibe }),
  _setTimezone: (tz) => set({ userTimezone: tz }),

  applyRemoteVibe: (currentVibe) => {
    const { lastLocalMutationAt } = get();
    if (Date.now() - lastLocalMutationAt < LOCAL_MUTATION_GUARD_MS) {
      // A local mutation just happened — ignore the (likely stale) remote snapshot.
      return;
    }
    set({ currentVibe });
  },

  setVibe: async (vibe, userId) => {
    if (!userId) return;

    // Optimistic update first so UI persists immediately
    set({ currentVibe: vibe, lastLocalMutationAt: Date.now() });
    patchVibeInCache(userId, vibe);

    const { error } = await supabase
      .from('profiles')
      .update({
        current_vibe: vibe?.type || null,
        vibe_gif_url: vibe?.gifUrl || null,
        custom_vibe_tags: vibe?.customTags || [],
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error setting vibe:', error);
    }
  },

  addCustomVibe: async (tag, userId) => {
    if (!userId) return;

    const { currentVibe } = get();
    const existingTags = currentVibe?.customTags || [];
    if (existingTags.includes(tag)) return;

    const newTags = [...existingTags, tag];
    const vibeType = currentVibe?.type || 'custom';
    const newVibe: Vibe = { type: vibeType, customTags: newTags, gifUrl: currentVibe?.gifUrl };

    // Optimistic update
    set({ currentVibe: newVibe });
    patchVibeInCache(userId, newVibe);

    const { error } = await supabase
      .from('profiles')
      .update({ current_vibe: vibeType, custom_vibe_tags: newTags })
      .eq('user_id', userId);

    if (error) console.error('Error adding custom vibe:', error);
  },

  removeCustomVibe: async (tag, userId) => {
    if (!userId) return;

    const { currentVibe } = get();
    const existingTags = currentVibe?.customTags || [];
    const newTags = existingTags.filter(t => t !== tag);
    const gifUrl = currentVibe?.gifUrl;
    const vibeType = currentVibe?.type || 'custom';

    if (newTags.length === 0) {
      const keepVibe = vibeType !== 'custom' || !!gifUrl;
      const next = keepVibe ? { type: vibeType, customTags: [], gifUrl } : null;

      // Optimistic update
      set({ currentVibe: next });
      patchVibeInCache(userId, next);

      const { error } = await supabase
        .from('profiles')
        .update({ current_vibe: keepVibe ? vibeType : null, custom_vibe_tags: [] })
        .eq('user_id', userId);
      if (error) console.error('Error removing custom vibe:', error);
    } else {
      const next = { type: vibeType, customTags: newTags, gifUrl };

      // Optimistic update
      set({ currentVibe: next });
      patchVibeInCache(userId, next);

      const { error } = await supabase
        .from('profiles')
        .update({ custom_vibe_tags: newTags })
        .eq('user_id', userId);
      if (error) console.error('Error removing custom vibe:', error);
    }
  },
}));
