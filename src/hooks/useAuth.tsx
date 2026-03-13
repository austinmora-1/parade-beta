/**
 * AuthContext — a single Supabase auth subscription shared across the whole app.
 *
 * Problem: useAuth() was called in 58+ components. Each call set up its own
 * onAuthStateChange listener + getSession() fetch, resulting in 58 concurrent
 * subscriptions and redundant network calls on every page load.
 *
 * Fix: Move auth state into a React context. One <AuthProvider> at the app root
 * creates a single subscription. All consumers call useAuth() which reads from
 * that context — zero additional subscriptions, zero additional fetches.
 *
 * Migration: drop-in compatible. No call sites need to change — useAuth() still
 * returns the same { user, session, loading, signUp, signIn, signOut, ... } shape.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ data: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ data: any; error: any }>;
  updatePassword: (newPassword: string) => Promise<{ data: any; error: any }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up the single auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Hydrate with the current session immediately (avoids a loading flash
    // when the token is already valid in localStorage).
    // Race guard: only write if onAuthStateChange hasn't already fired.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(s => s ?? initialSession);
      setUser(u => u ?? (initialSession?.user ?? null));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    return supabase.auth.updateUser({ password: newPassword });
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Drop-in replacement for the old useAuth() hook.
 * All 58 call sites work unchanged — they now read from the shared context
 * instead of each creating their own subscription.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Wrap your app root with <AuthProvider>.');
  }
  return ctx;
}
