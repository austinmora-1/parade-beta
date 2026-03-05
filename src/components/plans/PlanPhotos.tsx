import { useState, useEffect, useRef } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedUrls } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlanPhoto {
  id: string;
  plan_id: string;
  uploaded_by: string;
  file_path: string;
  caption: string | null;
  created_at: string;
  uploader_name?: string;
}

interface PlanPhotosProps {
  planId: string;
}

export function PlanPhotos({ planId }: PlanPhotosProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PlanPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PlanPhoto | null>(null);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('plan_photos')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching photos:', error);
      setLoading(false);
      return;
    }

    // Resolve uploader names
    const uploaderIds = [...new Set((data || []).map(p => p.uploaded_by))];
    let nameMap: Record<string, string> = {};
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, display_name')
        .in('user_id', uploaderIds);
      for (const p of (profiles || [])) {
        if (p.user_id) nameMap[p.user_id] = p.display_name || 'Someone';
      }
    }

    setPhotos((data || []).map(p => ({
      ...p,
      uploader_name: nameMap[p.uploaded_by] || 'Someone',
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();

    // Real-time subscription for new photos
    const channel = supabase
      .channel(`plan-photos:${planId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plan_photos',
          filter: `plan_id=eq.${planId}`,
        },
        () => { fetchPhotos(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'plan_photos',
          filter: `plan_id=eq.${planId}`,
        },
        () => { fetchPhotos(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [planId]);

  // Resolve signed URLs whenever photos change
  useEffect(() => {
    if (photos.length === 0) return;
    const paths = photos.map(p => p.file_path);
    getSignedUrls('plan-photos', paths).then(setPhotoUrls);
  }, [photos]);

  const getPhotoUrl = (filePath: string) => {
    return photoUrls.get(filePath) || '';
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const ext = file.name.split('.').pop();
        const filePath = `${user.id}/${planId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('plan-photos')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Failed to upload photo');
          continue;
        }

        const { error: dbError } = await supabase
          .from('plan_photos')
          .insert({
            plan_id: planId,
            uploaded_by: user.id,
            file_path: filePath,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          toast.error('Failed to save photo');
        }
      }

      toast.success('Photo added! 📸');
      await fetchPhotos();
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: PlanPhoto) => {
    const { error: storageError } = await supabase.storage
      .from('plan-photos')
      .remove([photo.file_path]);

    if (storageError) console.error('Storage delete error:', storageError);

    const { error: dbError } = await supabase
      .from('plan_photos')
      .delete()
      .eq('id', photo.id);

    if (dbError) {
      toast.error('Failed to delete photo');
      return;
    }

    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setSelectedPhoto(null);
    toast.success('Photo deleted');
  };

  const addPhotoOverlay = (
    <button
      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
      disabled={uploading}
      className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70 transition-colors"
    >
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ImagePlus className="h-3.5 w-3.5" />
      )}
      Add Photo
    </button>
  );

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-b border-border py-12 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm">Add photos to this plan</span>
        </button>
      ) : photos.length === 1 ? (
        <div className="relative">
          <button
            onClick={() => setSelectedPhoto(photos[0])}
            className="relative w-full aspect-[4/3] overflow-hidden bg-muted group"
          >
            <img
              src={getPhotoUrl(photos[0].file_path)}
              alt="Plan photo"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          </button>
          {addPhotoOverlay}
        </div>
      ) : photos.length === 2 ? (
        <div className="relative">
          <div className="grid grid-cols-2 gap-0.5">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="relative aspect-[3/4] overflow-hidden bg-muted group"
              >
                <img
                  src={getPhotoUrl(photo.file_path)}
                  alt="Plan photo"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          {addPhotoOverlay}
        </div>
      ) : (
        <div className="relative">
          <div className="grid grid-cols-3 gap-0.5" style={{ gridTemplateRows: 'auto auto' }}>
            <button
              onClick={() => setSelectedPhoto(photos[0])}
              className="relative col-span-2 row-span-2 overflow-hidden bg-muted group"
              style={{ aspectRatio: '1' }}
            >
              <img
                src={getPhotoUrl(photos[0].file_path)}
                alt="Plan photo"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </button>
            {photos.slice(1, 3).map((photo, i) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="relative aspect-square overflow-hidden bg-muted group"
              >
                <img
                  src={getPhotoUrl(photo.file_path)}
                  alt="Plan photo"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {i === 1 && photos.length > 3 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">+{photos.length - 3}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
          {addPhotoOverlay}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={getPhotoUrl(selectedPhoto.file_path)}
              alt="Plan photo"
              className="w-full rounded-lg max-h-[80vh] object-contain"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              {selectedPhoto.uploaded_by === user?.id && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => handleDelete(selectedPhoto)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setSelectedPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-center text-sm text-white/70">
              Added by {selectedPhoto.uploader_name} · {new Date(selectedPhoto.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
