import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ElephantLoader } from '@/components/ui/ElephantLoader';
import paradeLogo from '@/assets/parade-logo.png';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      // First, let Supabase process the hash fragment from the URL
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        toast.error('That reset link looks expired');
        setIsVerifying(false);
        return;
      }

      if (session) {
        setIsValidSession(true);
      } else {
        toast.error("That link's expired — grab a fresh one?");
      }
      
      setIsVerifying(false);
    };

    // Listen for auth state changes (important for processing the recovery token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setIsVerifying(false);
      } else if (event === 'SIGNED_IN' && session) {
        // User might have a valid session from the recovery link
        setIsValidSession(true);
        setIsVerifying(false);
      }
    });

    // Small delay to allow hash processing
    setTimeout(checkSession, 100);

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Those passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password needs at least 6 characters');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("You're all set ✨");
      navigate('/');
    }

    setIsLoading(false);
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/10 flex items-center justify-center p-4">
        <ElephantLoader />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <img src={paradeLogo} alt="Parade" className="h-16 w-16 rounded-2xl shadow-lg" />
            </div>
            <CardTitle className="text-xl">Link Expired</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/landing')} 
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src={paradeLogo} alt="Parade" className="h-20 w-20 rounded-2xl shadow-lg" />
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground mb-2">Parade</h1>
          <p className="text-muted-foreground">Set your new password</p>
        </div>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
