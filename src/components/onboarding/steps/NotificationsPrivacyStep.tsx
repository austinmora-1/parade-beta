import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OnboardingData } from '../OnboardingWizard';
import { HomeScreenStep } from './HomeScreenStep';
import { NotificationsStep } from './NotificationsStep';
import { Eye, MapPin, Sparkles, MessageCircle } from 'lucide-react';

interface NotificationsPrivacyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function NotificationsPrivacyStep({ data, updateData }: NotificationsPrivacyStepProps) {
  const privacyToggles = [
    {
      id: 'showAvailability',
      icon: Eye,
      title: 'Show Availability',
      description: 'Friends can see when you\'re free',
      checked: data.showAvailability,
      onChange: (checked: boolean) => updateData({ showAvailability: checked }),
    },
    {
      id: 'showLocation',
      icon: MapPin,
      title: 'Location Status',
      description: 'Show if you\'re home or away',
      checked: data.showLocation,
      onChange: (checked: boolean) => updateData({ showLocation: checked }),
    },
    {
      id: 'showVibeStatus',
      icon: Sparkles,
      title: 'Vibe Status',
      description: 'Share your current mood',
      checked: data.showVibeStatus,
      onChange: (checked: boolean) => updateData({ showVibeStatus: checked }),
    },
    {
      id: 'allowAllHangRequests',
      icon: MessageCircle,
      title: 'Allow Hangout Proposals',
      description: 'Friends can propose hangouts',
      checked: data.allowAllHangRequests,
      onChange: (checked: boolean) => updateData({ allowAllHangRequests: checked }),
    },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Notifications & Privacy</h1>
        <p className="text-muted-foreground">Set up how you want to stay connected.</p>
      </div>

      <div className="space-y-6">
        {/* Home Screen */}
        <div className="rounded-xl border border-border bg-card p-4">
          <HomeScreenStep />
        </div>

        {/* Notifications */}
        <div className="rounded-xl border border-border bg-card p-4">
          <NotificationsStep />
        </div>

        {/* Privacy Toggles */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Privacy & Sharing</Label>
          <div className="space-y-2">
            {privacyToggles.map((toggle) => (
              <div
                key={toggle.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <toggle.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor={toggle.id} className="text-sm font-medium cursor-pointer leading-tight">
                      {toggle.title}
                    </Label>
                    <p className="text-xs text-muted-foreground leading-tight">{toggle.description}</p>
                  </div>
                </div>
                <Switch
                  id={toggle.id}
                  checked={toggle.checked}
                  onCheckedChange={toggle.onChange}
                  className="ml-2 shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
