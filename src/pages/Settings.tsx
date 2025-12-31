import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, MapPin, Share2 } from 'lucide-react';

export default function Settings() {
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Profile</h2>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" defaultValue="Alex Johnson" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="alex@example.com" />
            </div>
          </div>

          <Button variant="outline">Update Profile</Button>
        </div>
      </div>

      {/* Default Location */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Default Location</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location">Home Address</Label>
            <Input
              id="location"
              placeholder="Enter your default location..."
              defaultValue="123 Main St, San Francisco, CA"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            This will be used as your default location when you set your status to "Home"
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Plan Reminders</p>
              <p className="text-sm text-muted-foreground">
                Get notified before your plans
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Friend Requests</p>
              <p className="text-sm text-muted-foreground">
                Notify when someone wants to connect
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Plan Invitations</p>
              <p className="text-sm text-muted-foreground">
                Notify when you're invited to a plan
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      {/* Sharing */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <Share2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Sharing & Privacy</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Availability to Friends</p>
              <p className="text-sm text-muted-foreground">
                Let connected friends see your availability
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Vibe Status</p>
              <p className="text-sm text-muted-foreground">
                Display your current vibe to friends
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Discoverable</p>
              <p className="text-sm text-muted-foreground">
                Let others find you by email or name
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}
