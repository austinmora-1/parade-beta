import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format, isPast, isSameDay } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Calendar, 
  Settings, 
  Loader2,
  Users,
  Sparkles,
  Camera,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { toast } from 'sonner';
import { ImageCropDialog } from '@/components/profile/ImageCropDialog';
import { LocationTimeline } from '@/components/profile/LocationTimeline';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_address: string | null;
}

export default function Profile() {
  const { session } = useAuth();
  const { plans, friends } = usePlannerStore();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [bioSaveStatus, setBioSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [nameSaveStatus, setNameSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nameSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedBioRef = useRef<string>('');
  const lastSavedNameRef = useRef<string>('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, bio, home_address')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
        }

        setProfile(data);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [session?.user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropDialogOpen(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!session?.user) return;

    setIsUploading(true);

    try {
      const userId = session.user.id;
      const fileName = `avatar.jpg`;
      const filePath = `${userId}/${fileName}`;

      // Upload cropped image to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting query param
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Update local state
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploading(false);
      // Clean up object URL
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop('');
      }
    }
  };

  const handleEditBio = () => {
    const currentBio = profile?.bio || '';
    setBioValue(currentBio);
    lastSavedBioRef.current = currentBio;
    setBioSaveStatus('idle');
    setIsEditingBio(true);
  };

  const handleCancelBio = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setIsEditingBio(false);
    setBioValue('');
    setBioSaveStatus('idle');
  };

  const saveBio = useCallback(async (value: string) => {
    if (!session?.user) return;

    const trimmedBio = value.trim();
    if (trimmedBio === lastSavedBioRef.current) return; // No changes

    setBioSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: trimmedBio || null })
        .eq('user_id', session.user.id);

      if (error) throw error;

      lastSavedBioRef.current = trimmedBio;
      setProfile(prev => prev ? { ...prev, bio: trimmedBio || null } : null);
      setBioSaveStatus('saved');
      
      // Reset to idle after showing "Saved" briefly
      setTimeout(() => setBioSaveStatus('idle'), 1500);
    } catch (error) {
      console.error('Error updating bio:', error);
      toast.error('Failed to save bio');
      setBioSaveStatus('idle');
    }
  }, [session?.user]);

  const handleBioChange = (value: string) => {
    if (value.length > 500) return; // Enforce max length
    
    setBioValue(value);
    setBioSaveStatus('idle');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save (1.5 seconds after user stops typing)
    saveTimeoutRef.current = setTimeout(() => {
      saveBio(value);
    }, 1500);
  };

  const handleBioBlur = () => {
    // Save immediately on blur if there are unsaved changes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveBio(bioValue);
  };

  const handleCloseBioEditor = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // Save any pending changes before closing
    if (bioValue.trim() !== lastSavedBioRef.current) {
      saveBio(bioValue);
    }
    setIsEditingBio(false);
  };

  // Name editing handlers
  const handleEditName = () => {
    const currentName = profile?.display_name || '';
    setNameValue(currentName);
    lastSavedNameRef.current = currentName;
    setNameSaveStatus('idle');
    setIsEditingName(true);
  };

  const saveName = useCallback(async (value: string) => {
    if (!session?.user) return;

    const trimmedName = value.trim();
    if (trimmedName === lastSavedNameRef.current) return;
    if (!trimmedName) return; // Don't save empty names

    setNameSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedName })
        .eq('user_id', session.user.id);

      if (error) throw error;

      lastSavedNameRef.current = trimmedName;
      setProfile(prev => prev ? { ...prev, display_name: trimmedName } : null);
      setNameSaveStatus('saved');
      
      setTimeout(() => setNameSaveStatus('idle'), 1500);
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Failed to save name');
      setNameSaveStatus('idle');
    }
  }, [session?.user]);

  const handleNameChange = (value: string) => {
    if (value.length > 100) return;
    
    setNameValue(value);
    setNameSaveStatus('idle');

    if (nameSaveTimeoutRef.current) {
      clearTimeout(nameSaveTimeoutRef.current);
    }

    nameSaveTimeoutRef.current = setTimeout(() => {
      saveName(value);
    }, 1500);
  };

  const handleNameBlur = () => {
    if (nameSaveTimeoutRef.current) {
      clearTimeout(nameSaveTimeoutRef.current);
    }
    saveName(nameValue);
  };

  const handleCloseNameEditor = () => {
    if (nameSaveTimeoutRef.current) {
      clearTimeout(nameSaveTimeoutRef.current);
    }
    if (nameValue.trim() !== lastSavedNameRef.current && nameValue.trim()) {
      saveName(nameValue);
    }
    setIsEditingName(false);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (nameSaveTimeoutRef.current) {
        clearTimeout(nameSaveTimeoutRef.current);
      }
    };
  }, []);

  // Get past plans (hangout history)
  const pastPlans = plans
    .filter(plan => isPast(plan.date) && !isSameDay(plan.date, new Date()))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10); // Show last 10 hangouts

  // Get connected friends count
  const connectedFriendsCount = friends.filter(f => f.status === 'connected').length;

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Extract city from address
  const getCity = (address: string | null | undefined) => {
    if (!address) return null;
    // Try to extract city - usually after the first comma or just the first part
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
    return parts[0].trim();
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open && imageToCrop) {
            URL.revokeObjectURL(imageToCrop);
            setImageToCrop('');
          }
        }}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
      />

      {/* Profile Header */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 md:h-32" />
        
        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          {/* Avatar with upload button */}
          <div className="-mt-12 mb-4 flex items-end justify-between md:-mt-16">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg md:h-32 md:w-32">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
                <AvatarFallback className="bg-primary text-2xl text-primary-foreground md:text-3xl">
                  {getInitials(profile?.display_name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Upload overlay */}
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              
              {/* Mobile-friendly upload button */}
              <button
                onClick={handleAvatarClick}
                disabled={isUploading}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110 md:hidden disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </div>

          {/* Name & Bio */}
          <div className="space-y-3">
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCloseNameEditor();
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                      }
                    }}
                    placeholder="Your name"
                    className="font-display text-2xl font-bold md:text-3xl bg-transparent border-b-2 border-primary outline-none w-full max-w-xs"
                    maxLength={100}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    {nameSaveStatus === 'saving' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {nameSaveStatus === 'saved' && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCloseNameEditor}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleEditName}
                  className="group flex items-center gap-2 text-left"
                >
                  <h1 className="font-display text-2xl font-bold md:text-3xl group-hover:text-primary transition-colors">
                    {profile?.display_name || 'Your Name'}
                  </h1>
                  <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              {getCity(profile?.home_address) && (
                <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{getCity(profile?.home_address)}</span>
                </div>
              )}
            </div>

            {isEditingBio ? (
              <div className="space-y-2">
                <Textarea
                  value={bioValue}
                  onChange={(e) => handleBioChange(e.target.value)}
                  onBlur={handleBioBlur}
                  placeholder="Tell us a little about yourself..."
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {bioValue.length}/500
                    </span>
                    {bioSaveStatus === 'saving' && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    {bioSaveStatus === 'saved' && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseBioEditor}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : profile?.bio ? (
              <div className="group flex items-start gap-2">
                <p className="text-muted-foreground flex-1">{profile.bio}</p>
                <button
                  onClick={handleEditBio}
                  className="shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleEditBio}
                className="text-muted-foreground italic hover:text-primary transition-colors text-left"
              >
                No bio yet. Click to add one
              </button>
            )}

            {/* Quick Stats */}
            <div className="flex gap-6 pt-2">
              <div className="text-center">
                <p className="font-display text-xl font-bold">{connectedFriendsCount}</p>
                <p className="text-sm text-muted-foreground">Friends</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-bold">{pastPlans.length}</p>
                <p className="text-sm text-muted-foreground">Hangouts</p>
              </div>
              <div className="text-center">
                <p className="font-display text-xl font-bold">{plans.filter(p => !isPast(p.date) || isSameDay(p.date, new Date())).length}</p>
                <p className="text-sm text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Location Timeline */}
      <LocationTimeline />

      {/* Hangout History */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Hangout History</h2>
          </div>
          <Link to="/plans">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>

        {pastPlans.length > 0 ? (
          <div className="space-y-3">
            {pastPlans.map((plan) => {
              const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG];
              return (
                <div
                  key={plan.id}
                  className="flex items-center gap-4 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                >
                  <div 
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: activityConfig ? `hsl(var(--${activityConfig.color}) / 0.2)` : 'hsl(var(--muted))' }}
                  >
                    {activityConfig?.icon || '📅'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{plan.title}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{format(plan.date, 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>{TIME_SLOT_LABELS[plan.timeSlot as TimeSlot]?.label || plan.timeSlot}</span>
                      {plan.location && (
                        <>
                          <span>•</span>
                          <span className="truncate">{plan.location.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {plan.participants && plan.participants.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{plan.participants.length}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-1">No hangouts yet</h3>
            <p className="text-muted-foreground mb-4">
              Your past hangouts will appear here
            </p>
            <Link to="/plans">
              <Button>Create Your First Plan</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
