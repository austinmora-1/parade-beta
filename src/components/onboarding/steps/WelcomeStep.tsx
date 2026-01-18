import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingData } from '../OnboardingWizard';
import paradeLogo from '@/assets/parade-logo.png';

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function WelcomeStep({ data, updateData }: WelcomeStepProps) {
  return (
    <div className="text-center">
      <div className="mb-8 flex justify-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
          <img src={paradeLogo} alt="Parade" className="h-16 w-16 rounded-2xl" />
        </div>
      </div>
      
      <h1 className="font-display text-3xl font-bold mb-3">
        Welcome to Parade! 🎉
      </h1>
      <p className="text-muted-foreground mb-8 text-lg">
        Let's get you set up so your friends know when you're free to hang out.
      </p>

      <div className="text-left space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-base">What should we call you?</Label>
          <Input
            id="displayName"
            placeholder="Your name"
            value={data.displayName}
            onChange={(e) => updateData({ displayName: e.target.value })}
            className="h-12 text-lg"
            autoFocus
          />
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          ✨ This will only take a minute, and you can change these settings anytime.
        </p>
      </div>
    </div>
  );
}
