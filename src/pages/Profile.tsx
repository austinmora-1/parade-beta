import { useState, useEffect, useRef, useCallback } from 'react';
import { getCompactPlanTitle, getPlanDisplayTitle } from '@/lib/planTitle';
import { Link, useNavigate } from 'react-router-dom';
import { format, isPast, isSameDay, isAfter } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  X,
  ChevronDown,
  Clock,
  Edit,
  Trash2,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS, TimeSlot, Plan } from '@/types/planner';
import { toast } from 'sonner';
import { ImageCropDialog } from '@/components/profile/ImageCropDialog';
import { cn } from '@/lib/utils';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { CreatePlanDialog } from '@/components/plans/CreatePlanDialog';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { ParticipantsList } from '@/components/plans/ParticipantsList';
import { CalendarCheck } from 'lucide-react';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  home_address: string | null;
  cover_photo_url: string | null;
}

export default function Profile() {
  const { session } = useAuth();
  const { updateProfile: updateGlobalProfile } = useCurrentUserProfile();
  const { plans, friends, deletePlan } = usePlannerStore();
  const navigate = useNavigate();
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedBioRef = useRef<string>('');
  const lastSavedNameRef = useRef<string>('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [cropMode, setCropMode] = useState<'avatar' | 'cover'>('avatar');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, bio, home_address, cover_photo_url')
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

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    // Create object URL for cropping
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropMode('avatar');
    setCropDialogOpen(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!session?.user) return;

    if (cropMode === 'cover') {
      await handleCoverUpload(croppedBlob);
    } else {
      await handleAvatarUpload(croppedBlob);
    }

    // Clean up object URL
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop);
      setImageToCrop('');
    }
  };

  const handleAvatarUpload = async (croppedBlob: Blob) => {
    if (!session?.user) return;
    setIsUploading(true);
    try {
      const userId = session.user.id;
      const filePath = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userId);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      updateGlobalProfile({ avatar_url: avatarUrl });
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverUpload = async (croppedBlob: Blob) => {
    if (!session?.user) return;
    setIsUploadingCover(true);
    try {
      const userId = session.user.id;
      const filePath = `${userId}/cover.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_photo_url: coverUrl })
        .eq('user_id', userId);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, cover_photo_url: coverUrl } : null);
      toast.success('Cover photo updated!');
    } catch (error) {
      console.error('Error uploading cover photo:', error);
      toast.error('Failed to upload cover photo');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return; }

    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropMode('cover');
    setCropDialogOpen(true);

    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleRemoveCover = async () => {
    if (!session?.user) return;
    setIsUploadingCover(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cover_photo_url: null })
        .eq('user_id', session.user.id);
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, cover_photo_url: null } : null);
      toast.success('Cover photo removed');
    } catch (error) {
      console.error('Error removing cover photo:', error);
      toast.error('Failed to remove cover photo');
    } finally {
      setIsUploadingCover(false);
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

  const timeSlotOrder: Record<string, number> = {
    'early-morning': 0, 'late-morning': 1, 'early-afternoon': 2,
    'late-afternoon': 3, 'evening': 4, 'late-night': 5,
  };

  // Get past plans (hangout history) - social activities (vibes: social)
  const pastPlans = plans
    .filter(plan => {
      const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG];
      return isPast(plan.date) && !isSameDay(plan.date, new Date()) && activityConfig?.vibeType === 'social';
    })
    .sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return (timeSlotOrder[b.timeSlot] ?? 0) - (timeSlotOrder[a.timeSlot] ?? 0);
    })
    .slice(0, 10);

  const [hangoutsOpen, setHangoutsOpen] = useState(true);
  
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const planToDelete = deleteConfirmId ? plans.find(p => p.id === deleteConfirmId) : null;
  const isOwner = planToDelete && (!planToDelete.userId || planToDelete.userId === session?.user?.id);

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditDialogOpen(true);
  };

  const handleDeletePlan = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeletePlan = async () => {
    if (!deleteConfirmId || !planToDelete) return;
    const hadParticipants = planToDelete.participants.length > 0;
    await deletePlan(deleteConfirmId);
    setDeleteConfirmId(null);
    if (!isOwner) {
      toast.success('You have declined this plan.');
    } else if (hadParticipants) {
      toast.success('Plan deleted. Participants have been notified.');
    } else {
      toast.success('Plan deleted.');
    }
  };

  const handleEditDialogClose = (open: boolean) => {
    if (!open) {
      setEditDialogOpen(false);
      setEditingPlan(null);
    }
  };

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
    <div className="animate-fade-in space-y-4 md:space-y-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden cover photo input */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverPhotoChange}
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
        aspect={cropMode === 'cover' ? 4 : 1}
        circular={cropMode === 'avatar'}
        title={cropMode === 'cover' ? 'Crop Cover Photo' : 'Crop Profile Picture'}
        outputWidth={cropMode === 'cover' ? 1600 : 1024}
        outputHeight={cropMode === 'cover' ? 400 : undefined}
      />

      {/* Profile Header */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="relative h-28 md:h-36 group/cover">
          {profile?.cover_photo_url ? (
            <img
              src={profile.cover_photo_url}
              alt="Cover photo"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
          )}
          <div className="absolute right-3 bottom-3 z-10 opacity-100 md:opacity-0 transition-opacity group-hover/cover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={isUploadingCover}
                  className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70 disabled:cursor-not-allowed"
                >
                  {isUploadingCover ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  Edit
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => coverInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />
                  {profile?.cover_photo_url ? 'Change Photo' : 'Add Photo'}
                </DropdownMenuItem>
                {profile?.cover_photo_url && (
                  <DropdownMenuItem onClick={handleRemoveCover} className="text-destructive focus:text-destructive">
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Profile Info */}
        <div className="relative px-4 pb-4 md:px-6 md:pb-5">
          {/* Avatar with upload button */}
          <div className="-mt-10 mb-3 flex items-end justify-between md:-mt-12">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-4 border-background shadow-lg md:h-24 md:w-24">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
                <AvatarFallback className="bg-primary text-xl text-primary-foreground md:text-2xl">
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
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Name & Bio */}
          <div className="space-y-2">
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
                    className="font-display text-xl font-bold md:text-2xl bg-transparent border-b-2 border-primary outline-none w-full max-w-xs"
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
                  <h1 className="font-display text-lg font-bold md:text-xl group-hover:text-primary transition-colors">
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
            <div className="flex gap-5 pt-1">
              <div className="text-center">
                <p className="font-display text-lg font-bold">{connectedFriendsCount}</p>
                <p className="text-xs text-muted-foreground">Friends</p>
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-bold">{pastPlans.length}</p>
                <p className="text-xs text-muted-foreground">Hangouts</p>
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-bold">{plans.filter(p => !isPast(p.date) || isSameDay(p.date, new Date())).length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <QuickStats />


      {/* Plan History */}
      <Collapsible open={hangoutsOpen} onOpenChange={setHangoutsOpen}>
        <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-soft">
          <CollapsibleTrigger asChild>
            <button className="mb-0 data-[state=open]:mb-4 flex w-full items-center justify-between group [&[data-state=open]]:mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm font-semibold">Plan History</h2>
                {pastPlans.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {pastPlans.length}
                  </span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {pastPlans.length > 0 ? (
              <div className="space-y-1.5">
                {pastPlans.map((plan) => {
                  const activityConfig = ACTIVITY_CONFIG[plan.activity as keyof typeof ACTIVITY_CONFIG] || { label: 'Activity', icon: '✨', color: 'activity-misc', vibeType: 'social' as const, category: 'staying-in' as const };
                  const timeSlotConfig = TIME_SLOT_LABELS[plan.timeSlot as TimeSlot];
                  const displayTitle = getCompactPlanTitle(plan);

                  const formatTime12 = (time: string) => {
                    const [h, m] = time.split(':').map(Number);
                    const ampm = h >= 12 ? 'pm' : 'am';
                    const hour12 = h % 12 || 12;
                    return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
                  };

                  return (
                    <div
                      key={plan.id}
                      onClick={() => navigate(`/plan/${plan.id}`)}
                      className="rounded-lg border-l-[3px] px-3 py-3 transition-all duration-200 cursor-pointer bg-muted/30 hover:bg-muted/50"
                      style={{ borderLeftColor: `hsl(var(--${activityConfig.color}))` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ActivityIcon config={activityConfig} size={18} />
                            <span className="text-sm font-medium truncate">{displayTitle}</span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-0.5 ml-[26px]">
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Clock className="h-3 w-3" />
                              {plan.startTime ? formatTime12(plan.startTime) + (plan.endTime ? ` – ${formatTime12(plan.endTime)}` : '') : timeSlotConfig?.time || plan.timeSlot}
                            </span>
                          </div>
                          {plan.location && (
                            <div className="flex items-center gap-0.5 text-xs text-muted-foreground mt-0.5 ml-[26px]">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{plan.location.name.split(' · ')[0].split(', ')[0].split(' - ')[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-between gap-1.5 shrink-0 self-stretch">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {plan.endDate
                              ? `${format(plan.date, 'MMM d')} – ${format(plan.endDate, 'MMM d')}`
                              : format(plan.date, 'EEE, MMM d')}
                          </span>
                          {plan.participants.filter(p => p.role !== 'subscriber').length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground" data-stop-card-click onClick={e => e.stopPropagation()}>
                              <Users className="h-3 w-3 shrink-0" />
                              <ParticipantsList participants={plan.participants.filter(p => p.role !== 'subscriber')} compact />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-3 text-4xl">📅</div>
                <p className="text-muted-foreground">No hangouts yet</p>
                <p className="text-sm text-muted-foreground">Your past hangouts will appear here</p>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Edit Plan Dialog */}
      <CreatePlanDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        editPlan={editingPlan}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isOwner ? 'Delete this plan?' : 'Decline this plan?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner
                ? planToDelete?.participants && planToDelete.participants.length > 0
                  ? 'This will permanently delete the plan for you and all participants.'
                  : 'This will permanently delete this plan.'
                : 'This will remove the plan from your view. The organizer and other participants will not be affected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isOwner ? 'Delete' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
