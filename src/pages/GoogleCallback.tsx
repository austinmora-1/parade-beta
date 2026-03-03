import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function GoogleCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(error);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Missing authorization parameters');
      return;
    }

    // Forward to edge function
    supabase.functions
      .invoke('google-calendar-callback', {
        body: { code, state },
      })
      .then(({ data, error: fnError }) => {
        if (fnError || data?.error) {
          setStatus('error');
          setErrorMsg(fnError?.message || data?.error || 'Connection failed');
        } else {
          setStatus('success');
          // Redirect to settings after brief success display
          setTimeout(() => {
            window.location.href = '/settings?calendar=connected';
          }, 1500);
        }
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Connection failed');
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting your calendar...</h1>
            <p className="text-muted-foreground">Please wait while we finish setting up.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold">Calendar Connected!</h1>
            <p className="text-muted-foreground">Redirecting you back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Connection Failed</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
            <a href="/settings" className="text-primary hover:underline text-sm">
              Return to Settings
            </a>
          </>
        )}
      </div>
    </div>
  );
}
