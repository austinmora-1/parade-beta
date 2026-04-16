import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDisplayName } from '@/lib/formatName';

interface CurrentUserProfile {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  location_status: string | null;
  timezone: string | null;
  home_address: string | null;
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
        .select('display_name, first_name, last_name, avatar_url, location_status, timezone, home_address')
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
      : { display_name: null, first_name: null, last_name: null, avatar_url: null, location_status: null, timezone: null, home_address: null, ...updates };
    notifyListeners(newProfile);
  }, []);

  // Function to refetch profile from database
  const refetchProfile = useCallback(async () => {
    if (!session?.user) return;

    const { data } = await supabase
      .from('profiles')
        .select('display_name, first_name, last_name, avatar_url, location_status, timezone, home_address')
      .eq('user_id', session.user.id)
      .single();

    notifyListeners(data);
  }, [session?.user]);

  const formattedName = profile ? formatDisplayName({
    firstName: profile.first_name,
    lastName: profile.last_name,
    displayName: profile.display_name,
  }) : null;

  return { profile, formattedName, isLoading, updateProfile, refetchProfile };
}
