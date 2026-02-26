import { useState, useEffect, useRef } from 'react';
import { Camera, X, Loader2, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('plan-photos').getPublicUrl(filePath);
    return data.publicUrl;
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Photos {photos.length > 0 && `(${photos.length})`}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          Add Photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-border py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm">Add photos to this plan</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
            >
              <img
                src={getPublicUrl(photo.file_path)}
                alt="Plan photo"
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
          {/* Add more button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img
              src={getPublicUrl(selectedPhoto.file_path)}
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
