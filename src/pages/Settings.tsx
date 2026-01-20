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
    <div className="animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
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

      <Accordion type="multiple" defaultValue={['profile']} className="space-y-2">
        {/* Profile Section */}
        <AccordionItem value="profile" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Profile</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">Display Name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); handleChange(); }}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted h-8 text-sm"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Default Availability */}
        <AccordionItem value="availability" className="rounded-xl border border-border bg-card shadow-soft overflow-visible">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Default Availability</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 overflow-visible">
            <div className="space-y-4 pt-1">
              {/* Home Base */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  Home Base
                </Label>
                <CityAutocomplete
                  value={homeAddress}
                  onChange={(value) => { setHomeAddress(value); handleChange(); }}
                  placeholder="Search for your city..."
                />
              </div>

              <Separator />

              {/* Standard Work Hours */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Standard Work Hours</Label>
                  <p className="text-[10px] text-muted-foreground">
                    We'll mark you as busy during these times
                  </p>
                </div>
                
                {/* Work Days */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground">Work days</span>
                  <div className="flex gap-1">
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
                            "flex-1 py-1.5 rounded-md text-xs font-medium transition-all",
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

                {/* Time Sliders */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Start</span>
                      <span className="text-[10px] font-bold text-primary">{formatTime(workStartHour)}</span>
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
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">End</span>
                      <span className="text-[10px] font-bold text-primary">{formatTime(workEndHour)}</span>
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
              </div>

              <Separator />

              {/* Default Status & Vibes in a row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Default Availability Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Default Status</Label>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { setDefaultAvailability('free'); handleChange(); }}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                        defaultAvailability === 'free'
                          ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      ✓ Free
                    </button>
                    <button
                      onClick={() => { setDefaultAvailability('unavailable'); handleChange(); }}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                        defaultAvailability === 'unavailable'
                          ? "bg-destructive/20 text-destructive ring-1 ring-destructive/30"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      ✗ Busy
                    </button>
                  </div>
                </div>

                {/* Default Vibes (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Default Vibes</Label>
                    <span className="text-[10px] text-muted-foreground">Optional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
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
                            "flex items-center justify-center gap-1 py-1 px-1.5 rounded-md text-[10px] font-medium transition-all",
                            isSelected
                              ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span>{config.icon}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Notifications */}
        <AccordionItem value="notifications" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Notifications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Plan Reminders</p>
                  <p className="text-[10px] text-muted-foreground">Get notified before your plans</p>
                </div>
                <Switch
                  checked={planReminders}
                  onCheckedChange={(checked) => { setPlanReminders(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Friend Requests</p>
                  <p className="text-[10px] text-muted-foreground">Notify when someone wants to connect</p>
                </div>
                <Switch
                  checked={friendRequests}
                  onCheckedChange={(checked) => { setFriendRequests(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Plan Invitations</p>
                  <p className="text-[10px] text-muted-foreground">Notify when you're invited to a plan</p>
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
        <AccordionItem value="calendar" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Calendar</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="pt-1">
              <CalendarIntegration isEmbedded />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Sharing & Privacy */}
        <AccordionItem value="privacy" className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="font-display text-sm font-semibold">Sharing & Privacy</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Availability</p>
                  <p className="text-[10px] text-muted-foreground">Let friends see your availability</p>
                </div>
                <Switch
                  checked={showAvailability}
                  onCheckedChange={(checked) => { setShowAvailability(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Location</p>
                  <p className="text-[10px] text-muted-foreground">Let friends know if you're home or away</p>
                </div>
                <Switch
                  checked={showLocation}
                  onCheckedChange={(checked) => { setShowLocation(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Show Vibe</p>
                  <p className="text-[10px] text-muted-foreground">Display your current vibe</p>
                </div>
                <Switch
                  checked={showVibeStatus}
                  onCheckedChange={(checked) => { setShowVibeStatus(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">Discoverable</p>
                  <p className="text-[10px] text-muted-foreground">Let others find you by email or name</p>
                </div>
                <Switch
                  checked={discoverable}
                  onCheckedChange={(checked) => { setDiscoverable(checked); handleChange(); }}
                />
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Hangout Requests</p>
                    <p className="text-[10px] text-muted-foreground">
                      {allowAllHangRequests ? 'All friends can request' : 'Only selected friends'}
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
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs font-medium mb-2">Select friends:</p>
                        {friends.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No connected friends yet.</p>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {friends.map((friend) => (
                              <div
                                key={friend.id}
                                className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  id={`friend-${friend.id}`}
                                  checked={allowedFriendIds.includes(friend.id)}
                                  onCheckedChange={() => toggleFriendAllowed(friend.id)}
                                />
                                <Label htmlFor={`friend-${friend.id}`} className="flex-1 cursor-pointer font-normal text-xs">
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
        <AccordionItem value="account" className="rounded-xl border border-destructive/20 bg-card shadow-soft overflow-hidden">
          <AccordionTrigger className="px-4 py-2.5 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-destructive" />
              <span className="font-display text-sm font-semibold">Account</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-3">
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium">Sign Out</p>
                <p className="text-[10px] text-muted-foreground">Log out of your Parade account</p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
