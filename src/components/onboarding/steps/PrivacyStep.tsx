import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { OnboardingData } from '../OnboardingWizard';
import { Eye, Sparkles, Users, MapPin, MessageCircle } from 'lucide-react';

interface PrivacyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function PrivacyStep({ data, updateData }: PrivacyStepProps) {
  const settings = [
    {
      id: 'showAvailability',
      icon: Eye,
      title: 'Share my availability',
      description: 'Friends can see when you\'re free to hang out',
      checked: data.showAvailability,
      onChange: (checked: boolean) => updateData({ showAvailability: checked }),
    },
    {
      id: 'showLocation',
      icon: MapPin,
      title: 'Share my location status',
      description: 'Let friends know if you\'re home, traveling, or away',
      checked: data.showLocation,
      onChange: (checked: boolean) => updateData({ showLocation: checked }),
    },
    {
      id: 'showVibeStatus',
      icon: Sparkles,
      title: 'Share my vibe',
      description: 'Let friends see your current mood or energy level',
      checked: data.showVibeStatus,
      onChange: (checked: boolean) => updateData({ showVibeStatus: checked }),
    },
    {
      id: 'discoverable',
      icon: Users,
      title: 'Make me discoverable',
      description: 'Friends can find you by searching your name or email',
      checked: data.discoverable,
      onChange: (checked: boolean) => updateData({ discoverable: checked }),
    },
    {
      id: 'allowAllHangRequests',
      icon: MessageCircle,
      title: 'Accept requests from all friends',
      description: 'Allow any friend to send you hangout requests',
      checked: data.allowAllHangRequests,
      onChange: (checked: boolean) => updateData({ allowAllHangRequests: checked }),
    },
  ];

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Eye className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">
          Privacy Settings
        </h1>
        <p className="text-muted-foreground">
          Control what your friends can see about you.
        </p>
      </div>

      <div className="space-y-3">
        {settings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <setting.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <Label htmlFor={setting.id} className="text-base font-medium cursor-pointer">
                  {setting.title}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>
              </div>
            </div>
            <Switch
              id={setting.id}
              checked={setting.checked}
              onCheckedChange={setting.onChange}
              className="ml-3 shrink-0"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm text-primary">
          💡 We recommend keeping these on for the best experience, but you're in control!
        </p>
      </div>
    </div>
  );
}
