import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, MapPin, Share2, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Settings() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState('Alex Johnson');
  const [email, setEmail] = useState('alex@example.com');
  const [homeAddress, setHomeAddress] = useState('123 Main St, San Francisco, CA');

  // Notification settings
  const [planReminders, setPlanReminders] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [planInvitations, setPlanInvitations] = useState(true);

  // Privacy settings
  const [showAvailability, setShowAvailability] = useState(true);
  const [showVibeStatus, setShowVibeStatus] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Simulate API call - replace with actual Supabase update
      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Logged out successfully');
      navigate('/landing');
    }
  };
  return (
    <div className="animate-fade-in space-y-8">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveChanges} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
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
              <Input
                id="name"
                value={displayName}
                onChange={(e) => { setDisplayName(e.target.value); handleChange(); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); handleChange(); }}
              />
            </div>
          </div>
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
              value={homeAddress}
              onChange={(e) => { setHomeAddress(e.target.value); handleChange(); }}
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
            <Switch
              checked={planReminders}
              onCheckedChange={(checked) => { setPlanReminders(checked); handleChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Friend Requests</p>
              <p className="text-sm text-muted-foreground">
                Notify when someone wants to connect
              </p>
            </div>
            <Switch
              checked={friendRequests}
              onCheckedChange={(checked) => { setFriendRequests(checked); handleChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Plan Invitations</p>
              <p className="text-sm text-muted-foreground">
                Notify when you're invited to a plan
              </p>
            </div>
            <Switch
              checked={planInvitations}
              onCheckedChange={(checked) => { setPlanInvitations(checked); handleChange(); }}
            />
          </div>
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
            <Switch
              checked={showAvailability}
              onCheckedChange={(checked) => { setShowAvailability(checked); handleChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Show Vibe Status</p>
              <p className="text-sm text-muted-foreground">
                Display your current vibe to friends
              </p>
            </div>
            <Switch
              checked={showVibeStatus}
              onCheckedChange={(checked) => { setShowVibeStatus(checked); handleChange(); }}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Discoverable</p>
              <p className="text-sm text-muted-foreground">
                Let others find you by email or name
              </p>
            </div>
            <Switch
              checked={discoverable}
              onCheckedChange={(checked) => { setDiscoverable(checked); handleChange(); }}
            />
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="rounded-2xl border border-destructive/20 bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <LogOut className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-lg font-semibold">Account</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Sign Out</p>
            <p className="text-sm text-muted-foreground">
              Log out of your Parade account
            </p>
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
