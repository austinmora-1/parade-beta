import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { User, Bell, MapPin, Share2, LogOut, Loader2, Calendar, Save, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarIntegration } from '@/components/settings/CalendarIntegration';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { cn } from '@/lib/utils';

// Helper function for formatting time
const formatTime = (decimalHour: number) => {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  if (minutes === 0) {
    return `${displayHours}${period}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
};

interface Friend {
  id: string;
  friend_name: string;
  friend_user_id: string | null;
}

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
  const [allowedFriendIds, setAllowedFriendIds] = useState<string[]>([]);

  // Default Availability settings
  const [workDays, setWorkDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [workStartHour, setWorkStartHour] = useState(9);
  const [workEndHour, setWorkEndHour] = useState(17);
  const [defaultAvailability, setDefaultAvailability] = useState<'free' | 'unavailable'>('free');
  const [defaultVibes, setDefaultVibes] = useState<VibeType[]>([]);

  // Friends list
  const [friends, setFriends] = useState<Friend[]>([]);

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
          setAllowedFriendIds(profile.allowed_hang_request_friend_ids || []);
          // Load default availability settings
          setWorkDays((profile as any).default_work_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
          setWorkStartHour((profile as any).default_work_start_hour ?? 9);
          setWorkEndHour((profile as any).default_work_end_hour ?? 17);
          setDefaultAvailability((profile as any).default_availability_status || 'free');
          setDefaultVibes((profile as any).default_vibes || []);
        }

        // Load friends
        const { data: friendsData } = await supabase
          .from('friendships')
          .select('id, friend_name, friend_user_id')
          .eq('user_id', session.user.id)
          .eq('status', 'accepted');

        if (friendsData) {
          setFriends(friendsData);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session?.user]);

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
          allowed_hang_request_friend_ids: allowedFriendIds,
          // Save default availability settings
          default_work_days: workDays,
          default_work_start_hour: workStartHour,
          default_work_end_hour: workEndHour,
          default_availability_status: defaultAvailability,
          default_vibes: defaultVibes,
        } as any)
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Settings saved');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = () => {
    setHasChanges(true);
  };

  const toggleFriendAllowed = (friendId: string) => {
    setAllowedFriendIds(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      }
      return [...prev, friendId];
    });
    handleChange();
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
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold md:text-2xl">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        {hasChanges && (
          <Button 
            onClick={handleSaveChanges} 
            disabled={isSaving} 
            size="sm" 
            className="gap-1.5 h-7 px-2.5 text-xs shrink-0"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            {isSaving ? 'Saving' : 'Save'}
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['profile']} className="space-y-4">
        {/* Profile Section */}
        <AccordionItem value="profile" className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Profile</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Default Availability */}
        <AccordionItem value="availability" className="rounded-2xl border border-border bg-card shadow-soft overflow-visible">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Default Availability</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 overflow-visible">
            <div className="space-y-6 pt-2">
              {/* Home Base */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Home Base
                </Label>
                <CityAutocomplete
                  value={homeAddress}
                  onChange={(value) => { setHomeAddress(value); handleChange(); }}
                  placeholder="Search for your city..."
                />
                <p className="text-xs text-muted-foreground">
                  Your home base city shown when status is "Home"
                </p>
              </div>

              <Separator />

              {/* Standard Work Hours */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Standard Work Hours</Label>
                <p className="text-xs text-muted-foreground -mt-2">
                  We'll mark you as busy during these times by default
                </p>
                
                {/* Work Days */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Work days</span>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'monday', label: 'M' },
                      { id: 'tuesday', label: 'T' },
                      { id: 'wednesday', label: 'W' },
                      { id: 'thursday', label: 'T' },
                      { id: 'friday', label: 'F' },
                      { id: 'saturday', label: 'S' },
                      { id: 'sunday', label: 'S' },
                    ].map((day) => {
                      const isSelected = workDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          onClick={() => {
                            setWorkDays(prev => 
                              prev.includes(day.id) 
                                ? prev.filter(d => d !== day.id)
                                : [...prev, day.id]
                            );
                            handleChange();
                          }}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Time */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Start time</span>
                    <span className="text-xs font-bold text-primary">{formatTime(workStartHour)}</span>
                  </div>
                  <Slider
                    value={[workStartHour]}
                    onValueChange={([value]) => { setWorkStartHour(value); handleChange(); }}
                    min={5}
                    max={12}
                    step={0.25}
                    className="w-full"
                  />
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">End time</span>
                    <span className="text-xs font-bold text-primary">{formatTime(workEndHour)}</span>
                  </div>
                  <Slider
                    value={[workEndHour]}
                    onValueChange={([value]) => { setWorkEndHour(value); handleChange(); }}
                    min={14}
                    max={22}
                    step={0.25}
                    className="w-full"
                  />
                </div>
              </div>

              <Separator />

              {/* Default Availability Status */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Default Status</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Your default availability outside of work hours
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDefaultAvailability('free'); handleChange(); }}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                      defaultAvailability === 'free'
                        ? "bg-primary/20 text-primary ring-2 ring-primary/30"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    ✓ Free
                  </button>
                  <button
                    onClick={() => { setDefaultAvailability('unavailable'); handleChange(); }}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all",
                      defaultAvailability === 'unavailable'
                        ? "bg-destructive/20 text-destructive ring-2 ring-destructive/30"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    ✗ Unavailable
                  </button>
                </div>
              </div>

              <Separator />

              {/* Default Vibes (Optional) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Default Vibes</Label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Pre-select vibes you're usually open to
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['social', 'chill', 'athletic', 'productive'] as VibeType[]).map((vibe) => {
                    const config = VIBE_CONFIG[vibe];
                    const isSelected = defaultVibes.includes(vibe);
                    return (
                      <button
                        key={vibe}
                        onClick={() => {
                          setDefaultVibes(prev => 
                            prev.includes(vibe) 
                              ? prev.filter(v => v !== vibe)
                              : [...prev, vibe]
                          );
                          handleChange();
                        }}
                        className={cn(
                          "flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all",
                          isSelected
                            ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Notifications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4 pt-2">
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
          </AccordionContent>
        </AccordionItem>

        {/* Calendar Integration */}
        <AccordionItem value="calendar" className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Calendar Integration</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="pt-2">
              <CalendarIntegration isEmbedded />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sharing & Privacy */}
        <AccordionItem value="privacy" className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Share2 className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Sharing & Privacy</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-4 pt-2">
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

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Allow Hangout Requests</p>
                    <p className="text-sm text-muted-foreground">
                      {allowAllHangRequests 
                        ? 'All friends will be able to send you a hangout request'
                        : 'Only selected friends can send you hangout requests'}
                    </p>
                  </div>
                  <Switch
                    checked={allowAllHangRequests}
                    onCheckedChange={(checked) => { setAllowAllHangRequests(checked); handleChange(); }}
                  />
                </div>

                <AnimatePresence>
                  {!allowAllHangRequests && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm font-medium mb-3">Select friends who can send you requests:</p>
                        {friends.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            You don't have any connected friends yet. Add friends to manage who can send you hangout requests.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {friends.map((friend) => (
                              <div
                                key={friend.id}
                                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  id={`friend-${friend.id}`}
                                  checked={allowedFriendIds.includes(friend.id)}
                                  onCheckedChange={() => toggleFriendAllowed(friend.id)}
                                />
                                <Label
                                  htmlFor={`friend-${friend.id}`}
                                  className="flex-1 cursor-pointer font-normal"
                                >
                                  {friend.friend_name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Account / Logout */}
        <AccordionItem value="account" className="rounded-2xl border border-destructive/20 bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5 text-destructive" />
              <span className="font-display text-lg font-semibold">Account</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="flex items-center justify-between pt-2">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
