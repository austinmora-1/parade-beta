import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingData } from '../OnboardingWizard';
import { Camera, Navigation, Loader2 } from 'lucide-react';
import { CityAutocomplete } from '@/components/ui/city-autocomplete';
import { ImageCropDialog } from '@/components/profile/ImageCropDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProfilePersonalizationStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export function ProfilePersonalizationStep({ data, updateData }: ProfilePersonalizationStepProps) {
  const { session } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState('');
  const [cropMode, setCropMode] = useState<'avatar' | 'cover'>('avatar');
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleFileSelect = (file: File, mode: 'avatar' | 'cover') => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropMode(mode);
    setCropDialogOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!session?.user) return;
    setIsUploading(true);
    try {
      const userId = session.user.id;
      if (cropMode === 'avatar') {
        const filePath = `${userId}/avatar.jpg`;
        const { error } = await supabase.storage
          .from('avatars')
          .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        updateData({ avatarUrl: `${urlData.publicUrl}?t=${Date.now()}` });
      } else {
        const filePath = `${userId}/cover.jpg`;
        const { error } = await supabase.storage
          .from('avatars')
          .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        updateData({ coverPhotoUrl: `${urlData.publicUrl}?t=${Date.now()}` });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop('');
      }
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&zoom=10`
          );
          const result = await response.json();
          if (result.address) {
            const city = result.address.city || result.address.town || result.address.village || result.address.municipality;
            const state = result.address.state;
            const parts = [city, state].filter(Boolean);
            if (parts.length > 0) {
              updateData({ homeAddress: parts.join(', ') });
            }
          }
        } catch (error) {
          console.error('Error getting location:', error);
        } finally {
          setIsLocating(false);
        }
      },
      () => setIsLocating(false)
    );
  };

  // Auto-set timezone from city
  const handleCityChange = (value: string) => {
    updateData({ homeAddress: value });
    // Timezone auto-detection based on browser
    if (!data.timezone) {
      updateData({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-display text-2xl font-bold mb-2">Personalize Your Profile</h1>
        <p className="text-muted-foreground">Make it yours — add a photo and set your home base.</p>
      </div>

      <div className="space-y-6">
        {/* Cover & Avatar */}
        <div className="relative">
          {/* Cover Photo */}
          <div
            onClick={() => coverInputRef.current?.click()}
            className="h-28 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-border cursor-pointer overflow-hidden relative group"
          >
            {data.coverPhotoUrl ? (
              <img src={data.coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Camera className="h-5 w-5 mr-2" />
                <span className="text-sm">Add cover photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Avatar overlapping cover */}
          <div className="absolute -bottom-8 left-4">
            <div
              onClick={() => avatarInputRef.current?.click()}
              className="relative cursor-pointer group"
            >
              <Avatar className="h-16 w-16 border-4 border-background">
                <AvatarImage src={data.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {data.firstName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6" /> {/* Spacer for avatar overlap */}

        {/* Home Location */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Home city</Label>
          <CityAutocomplete
            value={data.homeAddress}
            onChange={handleCityChange}
            placeholder="Search for your city..."
            className="[&_input]:h-11"
          />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
          >
            {isLocating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
            Use current location
          </Button>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Time zone</Label>
          <Input
            value={data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
            onChange={(e) => updateData({ timezone: e.target.value })}
            className="h-11 bg-muted/30"
            placeholder="Auto-detected from your location"
          />
          <p className="text-xs text-muted-foreground">Linked to your home location</p>
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label htmlFor="neighborhood" className="text-sm font-medium">
            Neighborhood <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="neighborhood"
            placeholder="e.g. Williamsburg, Mission District"
            value={data.neighborhood}
            onChange={(e) => updateData({ neighborhood: e.target.value })}
            className="h-11"
          />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'avatar')} />
      <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'cover')} />

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
        aspect={cropMode === 'avatar' ? 1 : 3}
        circularCrop={cropMode === 'avatar'}
      />
    </div>
  );
}
