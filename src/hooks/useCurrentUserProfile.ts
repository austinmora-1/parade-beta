import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CurrentUserProfile {
  display_name: string | null;
  avatar_url: string | null;
}

// Global state to share profile across components
let globalProfile: CurrentUserProfile | null = null;
let listeners: Set<(profile: CurrentUserProfile | null) => void> = new Set();

const notifyListeners = (profile: CurrentUserProfile | null) => {
  globalProfile = profile;
  listeners.forEach(listener => listener(profile));
};

export function useCurrentUserProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<CurrentUserProfile | null>(globalProfile);
  const [isLoading, setIsLoading] = useState(!globalProfile);

  // Subscribe to global profile updates
  useEffect(() => {
    const listener = (newProfile: CurrentUserProfile | null) => {
      setProfile(newProfile);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Fetch profile on mount
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        notifyListeners(null);
        setIsLoading(false);
        return;
      }

      // If we already have global profile, use it
      if (globalProfile) {
        setProfile(globalProfile);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', session.user.id)
        .single();

      notifyListeners(data);
      setIsLoading(false);
    }
    loadProfile();
  }, [session?.user]);

  // Function to update profile (call this after uploading new avatar)
  const updateProfile = useCallback((updates: Partial<CurrentUserProfile>) => {
    const newProfile = globalProfile 
      ? { ...globalProfile, ...updates }
      : { display_name: null, avatar_url: null, ...updates };
    notifyListeners(newProfile);
  }, []);

  // Function to refetch profile from database
  const refetchProfile = useCallback(async () => {
    if (!session?.user) return;

    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', session.user.id)
      .single();

    notifyListeners(data);
  }, [session?.user]);

  return { profile, isLoading, updateProfile, refetchProfile };
}
