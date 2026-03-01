import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Image, Smile, Loader2, Trash2 } from 'lucide-react';
import { SignedImage } from '@/components/ui/SignedImage';
import { GifPicker } from '@/components/chat/GifPicker';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VibeComment {
  id: string;
  vibe_send_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  // joined
  display_name?: string;
  avatar_url?: string;
}

interface VibeCommentsProps {
  vibeSendId: string;
}

export function VibeComments({ vibeSendId }: VibeCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<VibeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('vibe_comments')
      .select('*')
      .eq('vibe_send_id', vibeSendId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading comments:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const mapped: VibeComment[] = data.map(c => {
        const profile = profileMap.get(c.user_id);
        return {
          ...c,
          display_name: profile?.display_name || 'Someone',
          avatar_url: profile?.avatar_url || undefined,
        };
      });
      setComments(mapped);
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [vibeSendId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`vibe-comments-${vibeSendId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vibe_comments',
          filter: `vibe_send_id=eq.${vibeSendId}`,
        },
        () => loadComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [vibeSendId, loadComments]);

  // Auto-scroll on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const sendComment = async (mediaUrl?: string, mediaType?: string) => {
    if (!user) return;
    const content = text.trim();
    if (!content && !mediaUrl) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('vibe_comments')
        .insert({
          vibe_send_id: vibeSendId,
          user_id: user.id,
          content: content || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
        });

      if (error) throw error;
      setText('');
    } catch (err: any) {
      console.error('Error sending comment:', err);
      toast.error('Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `comments/${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('vibe-media')
        .upload(path, file);

      if (uploadError) throw uploadError;

      // Store the file path (bucket:path format) instead of public URL
      await sendComment(`storage:vibe-media:${path}`, 'image');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    sendComment(gifUrl, 'gif');
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('vibe_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendComment();
  };

  return (
    <div className="border-t border-border pt-3 space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h4>

      {/* Comments list */}
      <div
        ref={scrollRef}
        className={cn(
          "space-y-2.5 overflow-y-auto",
          comments.length > 3 ? "max-h-48" : ""
        )}
      >
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No comments yet — be the first to respond!
          </p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="group flex gap-2">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                {comment.avatar_url && <AvatarImage src={comment.avatar_url} />}
                <AvatarFallback className="text-[9px] bg-muted">
                  {(comment.display_name || 'S').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold truncate">{comment.display_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.user_id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
                {comment.content && (
                  <p className="text-xs text-foreground leading-relaxed mt-0.5">{comment.content}</p>
                )}
                {comment.media_url && (
                  <div className="mt-1 rounded-lg overflow-hidden border border-border max-w-[200px]">
                    <SignedImage
                      src={comment.media_url}
                      alt="Comment media"
                      className="w-full max-h-32 object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {uploadingImage ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Image className="h-3.5 w-3.5" />
          )}
        </button>

        <GifPicker onGifSelect={handleGifSelect}>
          <button
            type="button"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        </GifPicker>

        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment..."
          className="h-8 text-xs flex-1"
          disabled={sending}
        />

        <Button
          type="submit"
          size="icon"
          variant="ghost"
          disabled={sending || (!text.trim())}
          className="shrink-0 h-8 w-8"
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>
    </div>
  );
}
