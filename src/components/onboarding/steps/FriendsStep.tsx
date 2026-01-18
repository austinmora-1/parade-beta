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
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Invite Your Friends
        </h1>
        <p className="text-muted-foreground">
          Parade is better with friends! We'll send them an invite.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="friend@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleAddEmail} size="icon" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {data.friendEmails.length > 0 && (
          <div className="space-y-2">
            {data.friendEmails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{email}</span>
                </div>
                <button
                  onClick={() => handleRemoveEmail(email)}
                  className="rounded p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {data.friendEmails.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No friends added yet. You can always invite them later!
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
          <span className="text-lg">🎉</span>
          <p className="text-sm text-muted-foreground">
            You're all set! Click "Get Started" to start using Parade.
          </p>
        </div>
      </div>
    </div>
  );
}
