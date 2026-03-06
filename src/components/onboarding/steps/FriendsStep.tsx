import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OnboardingData } from '../OnboardingWizard';
import { Users, X, Plus, Mail } from 'lucide-react';

interface FriendsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function FriendsStep({ data, updateData }: FriendsStepProps) {
  const [emailInput, setEmailInput] = useState('');

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes('@') && !data.friendEmails.includes(email)) {
      updateData({ friendEmails: [...data.friendEmails, email] });
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    updateData({ friendEmails: data.friendEmails.filter(e => e !== email) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  return (
    <div>
      <div className="text-center mb-4">
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="font-display text-xl font-bold mb-1">
          Invite Your Friends
        </h1>
        <p className="text-sm text-muted-foreground">
          Parade is better with friends! We'll send them an invite.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-1.5">
          <Input
            type="email"
            placeholder="friend@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-8 text-sm"
          />
          <Button onClick={handleAddEmail} size="sm" variant="outline" className="h-8 w-8 p-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {data.friendEmails.length > 0 && (
          <div className="space-y-1.5">
            {data.friendEmails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs">{email}</span>
                </div>
                <button
                  onClick={() => handleRemoveEmail(email)}
                  className="rounded p-0.5 hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {data.friendEmails.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              No friends added yet. You can always invite them later!
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
          <span className="text-sm">🎉</span>
          <p className="text-xs text-muted-foreground">
            You're all set! Click "Get Started" to start using Parade.
          </p>
        </div>
      </div>
    </div>
  );
}
