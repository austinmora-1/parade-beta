import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingData } from '../OnboardingWizard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountCreationStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';

export function AccountCreationStep({ data, updateData }: AccountCreationStepProps) {
  const { user } = useAuth();
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>('idle');
  const [phoneStatus, setPhoneStatus] = useState<FieldStatus>('idle');
  const [usernameTimer, setUsernameTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [phoneTimer, setPhoneTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const { data: available } = await supabase.rpc('check_username_available', { p_username: username });
      setUsernameStatus(available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  };

  const checkPhone = async (phone: string) => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (!phone || digits.length < 7) {
      setPhoneStatus('idle');
      return;
    }
    setPhoneStatus('checking');
    try {
      // RPC is too new to be in generated types — cast supabase client
      const { data: available } = await (supabase.rpc as any)('check_phone_available', { p_phone: phone });
      setPhoneStatus(available ? 'available' : 'taken');
    } catch {
      setPhoneStatus('idle');
    }
  };

  const handleUsernameChange = (value: string) => {
    updateData({ displayName: value });
    if (usernameTimer) clearTimeout(usernameTimer);
    const timer = setTimeout(() => checkUsername(value), 500);
    setUsernameTimer(timer);
  };

  const handlePhoneChange = (value: string) => {
    updateData({ phoneNumber: value });
    if (phoneTimer) clearTimeout(phoneTimer);
    const timer = setTimeout(() => checkPhone(value), 500);
    setPhoneTimer(timer);
  };

  useEffect(() => {
    return () => {
      if (usernameTimer) clearTimeout(usernameTimer);
      if (phoneTimer) clearTimeout(phoneTimer);
    };
  }, [usernameTimer, phoneTimer]);

  const renderStatusIcon = (status: FieldStatus) => {
    if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === 'available') return <Check className="h-4 w-4 text-green-500" />;
    if (status === 'taken') return <X className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Create Your Account</h1>
        <p className="text-muted-foreground">Let's get the basics set up.</p>
      </div>

      <div className="space-y-4">
        {/* Email (read-only from signup) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email</Label>
          <Input
            value={user?.email || ''}
            disabled
            className="h-11 bg-muted/50 text-muted-foreground"
          />
        </div>

        {/* Phone (optional, but unique if provided) */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone number <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div className="relative">
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={data.phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className={cn("h-11 pr-10",
                phoneStatus === 'available' && 'border-green-500',
                phoneStatus === 'taken' && 'border-destructive'
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {renderStatusIcon(phoneStatus)}
            </div>
          </div>
          {phoneStatus === 'taken' && (
            <p className="text-xs text-destructive">This phone number is already linked to another account</p>
          )}
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium">Username</Label>
          <div className="relative">
            <Input
              id="username"
              placeholder="Choose a unique username"
              value={data.displayName}
              onChange={(e) => handleUsernameChange(e.target.value)}
              className={cn("h-11 pr-10", 
                usernameStatus === 'available' && 'border-green-500',
                usernameStatus === 'taken' && 'border-destructive'
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {renderStatusIcon(usernameStatus)}
            </div>
          </div>
          {usernameStatus === 'taken' && (
            <p className="text-xs text-destructive">This username is already taken</p>
          )}
          <p className="text-xs text-muted-foreground">This is how you'll appear to friends</p>
        </div>

        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium">First name</Label>
            <Input
              id="firstName"
              placeholder="First name"
              value={data.firstName}
              onChange={(e) => updateData({ firstName: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium">Last name</Label>
            <Input
              id="lastName"
              placeholder="Last name"
              value={data.lastName}
              onChange={(e) => updateData({ lastName: e.target.value })}
              className="h-11"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
