import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { User, Bell, MapPin, Share2, LogOut, Save, Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarIntegration } from '@/components/settings/CalendarIntegration';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  // Notification settings
  const [planReminders, setPlanReminders] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [planInvitations, setPlanInvitations] = useState(true);

  // Privacy settings
  const [showAvailability, setShowAvailability] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showVibeStatus, setShowVibeStatus] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);
  const [allowAllHangRequests, setAllowAllHangRequests] = useState(true);

  // Load profile data on mount
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        setEmail(session.user.email || '');

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
          toast.error('Failed to load profile');
        }

        if (profile) {
          setDisplayName(profile.display_name || '');
          setHomeAddress(profile.home_address || '');
          setPlanReminders(profile.plan_reminders ?? true);
          setFriendRequests(profile.friend_requests_notifications ?? true);
          setPlanInvitations(profile.plan_invitations_notifications ?? true);
          setShowAvailability(profile.show_availability ?? true);
          setShowLocation(profile.show_location ?? true);
          setShowVibeStatus(profile.show_vibe_status ?? true);
          setDiscoverable(profile.discoverable ?? true);
          setAllowAllHangRequests(profile.allow_all_hang_requests ?? true);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session?.user]);

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!session?.user) {
      toast.error('You must be logged in to save settings');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          home_address: homeAddress,
          plan_reminders: planReminders,
          friend_requests_notifications: friendRequests,
          plan_invitations_notifications: planInvitations,
          show_availability: showAvailability,
          show_location: showLocation,
          show_vibe_status: showVibeStatus,
          discoverable: discoverable,
          allow_all_hang_requests: allowAllHangRequests,
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                disabled
                className="bg-muted"
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

      {/* Calendar Integration */}
      <CalendarIntegration />

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
              <p className="font-medium">Show Location Status</p>
              <p className="text-sm text-muted-foreground">
                Let friends know if you're home or away
              </p>
            </div>
            <Switch
              checked={showLocation}
              onCheckedChange={(checked) => { setShowLocation(checked); handleChange(); }}
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

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Accept Requests from All Friends</p>
              <p className="text-sm text-muted-foreground">
                Allow any friend to send you hangout requests
              </p>
            </div>
            <Switch
              checked={allowAllHangRequests}
              onCheckedChange={(checked) => { setAllowAllHangRequests(checked); handleChange(); }}
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
