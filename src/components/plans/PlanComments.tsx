import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getElephantAvatar } from '@/lib/elephantAvatars';

interface PlanComment {
  id: string;
  plan_id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
}

interface PlanCommentsProps {
  planId: string;
  /** Compact mode for feed cards — shows count only */
  compact?: boolean;
}

export function PlanComments({ planId, compact = false }: PlanCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<PlanComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('plan_comments')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading plan comments:', error);
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

      const mapped: PlanComment[] = data.map(c => {
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
  }, [planId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`plan-comments-${planId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_comments',
          filter: `plan_id=eq.${planId}`,
        },
        () => loadComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [planId, loadComments]);

  // Auto-scroll on new comments
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('plan_comments')
      .delete()
      .eq('id', commentId);
    if (error) toast.error('Failed to delete comment');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('plan_comments')
        .insert({
          plan_id: planId,
          user_id: user.id,
          content: text.trim(),
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

  // Compact mode: just show the count
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        <span>{loading ? '…' : comments.length}</span>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </h4>

      {/* Comments list */}
      <div
        ref={scrollRef}
        className={cn(
          "space-y-2.5 overflow-y-auto",
          comments.length > 4 ? "max-h-64" : ""
        )}
      >
        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No comments yet — be the first!
          </p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="group flex gap-2">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarImage src={comment.avatar_url || getElephantAvatar(comment.display_name || 'User')} />
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input */}
      {user && (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
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
            disabled={sending || !text.trim()}
            className="shrink-0 h-8 w-8"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
