import { useState, useEffect, useRef, useCallback } from 'react';
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
import { User, Bell, MapPin, Share2, LogOut, Loader2, Calendar, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarIntegration } from '@/components/settings/CalendarIntegration';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

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

  const saveChanges = useCallback(async () => {
    if (!session?.user || initialLoadRef.current) return;

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
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [session?.user, displayName, homeAddress, planReminders, friendRequests, planInvitations, showAvailability, showLocation, showVibeStatus, discoverable, allowAllHangRequests, allowedFriendIds]);

  // Auto-save effect
  useEffect(() => {
    if (initialLoadRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [displayName, homeAddress, planReminders, friendRequests, planInvitations, showAvailability, showLocation, showVibeStatus, discoverable, allowAllHangRequests, allowedFriendIds, saveChanges]);

  // Mark initial load as complete after data is loaded
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure state is settled
      const timer = setTimeout(() => {
        initialLoadRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleChange = () => {
    // No longer needed for tracking, but keeping for compatibility
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
      {/* Header with Save Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>
        <AnimatePresence>
          {(isSaving || showSaved) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Saved</span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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

        {/* Default Location */}
        <AccordionItem value="location" className="rounded-2xl border border-border bg-card shadow-soft overflow-visible">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="font-display text-lg font-semibold">Default Location</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 overflow-visible">
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Home Base</Label>
                <CityAutocomplete
                  value={homeAddress}
                  onChange={(value) => { setHomeAddress(value); handleChange(); }}
                  placeholder="Search for your city..."
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Your home base city will be shown when you set your status to "Home"
              </p>
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
