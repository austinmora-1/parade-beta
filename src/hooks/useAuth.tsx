/**
 * useAuth — reads auth state from the shared AuthContext.
 * Re-exports AuthProvider for convenience.
 */
import { useContext } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext';

// Re-export so existing `import { AuthProvider } from '@/hooks/useAuth'` still works
export { AuthProvider } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be used inside <AuthProvider>. Wrap your app root with <AuthProvider>.');
  }
  return ctx;
}