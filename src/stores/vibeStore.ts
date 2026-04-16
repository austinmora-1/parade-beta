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

export interface VibeState {
  currentVibe: Vibe | null;
  userTimezone: string;
}

export interface VibeActions {
  _setVibe: (currentVibe: Vibe | null) => void;
  _setTimezone: (tz: string) => void;
  setVibe: (vibe: Vibe | null, userId: string) => Promise<void>;
  addCustomVibe: (tag: string, userId: string) => Promise<void>;
  removeCustomVibe: (tag: string, userId: string) => Promise<void>;
}

export const useVibeStore = create<VibeState & VibeActions>((set, get) => ({
  currentVibe: null,
  userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

  _setVibe: (currentVibe) => set({ currentVibe }),
  _setTimezone: (tz) => set({ userTimezone: tz }),

  setVibe: async (vibe, userId) => {
    if (!userId) return;

    const { error } = await supabase
      .from('profiles')
      .update({ current_vibe: vibe?.type || null, vibe_gif_url: vibe?.gifUrl || null })
      .eq('user_id', userId);

    if (error) {
      console.error('Error setting vibe:', error);
      return;
    }
    set({ currentVibe: vibe });
  },

  addCustomVibe: async (tag, userId) => {
    if (!userId) return;

    const { currentVibe } = get();
    const existingTags = currentVibe?.customTags || [];
    if (existingTags.includes(tag)) return;

    const newTags = [...existingTags, tag];
    const vibeType = currentVibe?.type || 'custom';
    const newVibe: Vibe = { type: vibeType, customTags: newTags, gifUrl: currentVibe?.gifUrl };

    const { error } = await supabase
      .from('profiles')
      .update({ current_vibe: vibeType, custom_vibe_tags: newTags })
      .eq('user_id', userId);

    if (error) {
      console.error('Error adding custom vibe:', error);
      return;
    }
    set({ currentVibe: newVibe });
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
      const { error } = await supabase
        .from('profiles')
        .update({ current_vibe: keepVibe ? vibeType : null, custom_vibe_tags: [] })
        .eq('user_id', userId);
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      set({ currentVibe: keepVibe ? { type: vibeType, customTags: [], gifUrl } : null });
    } else {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_vibe_tags: newTags })
        .eq('user_id', userId);
      if (error) {
        console.error('Error removing custom vibe:', error);
        return;
      }
      set({ currentVibe: { type: vibeType, customTags: newTags, gifUrl } });
    }
  },
}));
