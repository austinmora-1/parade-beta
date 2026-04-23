import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlannerStore } from '@/stores/plannerStore';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Copy, Check, Loader2, Phone, Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SearchResult {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { addFriend, friends } = usePlannerStore();
  const { toast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';
  const inviteLink = `https://helloparade.app/invite.html?ref=${encodeURIComponent(inviterName)}&from=${user?.id || ''}`;

  // Memoize to prevent infinite re-render loop
  const existingFriendUserIds = useMemo(
    () => new Set(friends.filter(f => f.friendUserId).map(f => f.friendUserId!)),
    [friends]
  );

  const connectedFriendUserIds = useMemo(
    () => new Set(friends.filter(f => f.status === 'connected' && f.friendUserId).map(f => f.friendUserId!)),
    [friends]
  );

  const pendingFriendUserIds = useMemo(
    () => new Set(friends.filter(f => f.status === 'pending' && f.friendUserId).map(f => f.friendUserId!)),
    [friends]
  );

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const isPhone = /^\+?\d/.test(query);
      const isEmail = query.includes('@');

      let results: SearchResult[] = [];

      if (isPhone) {
        const { data } = await supabase.rpc('search_users_by_phone_prefix', { p_query: query });
        results = (data as SearchResult[]) || [];
      } else if (isEmail) {
        const { data } = await supabase.rpc('search_users_by_email_prefix', { p_query: query });
        results = (data as SearchResult[]) || [];
      } else {
        const { data: emailResults } = await supabase.rpc('search_users_by_email_prefix', { p_query: query });
        const { data: nameResults } = await supabase
          .from('public_profiles')
          .select('user_id, display_name, avatar_url, bio')
          .ilike('display_name', `%${query}%`)
          .limit(20);

        const merged = new Map<string, SearchResult>();
        for (const r of (emailResults as SearchResult[]) || []) {
          if (r.user_id) merged.set(r.user_id, r);
        }
        for (const r of (nameResults as SearchResult[]) || []) {
          if (r.user_id && !merged.has(r.user_id)) merged.set(r.user_id, r);
        }
        results = Array.from(merged.values());
      }

      // Filter out self only — keep existing friends so we can show their status
      results = results.filter(r => r.user_id !== user?.id);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, [user?.id]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => searchUsers(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setSentIds(new Set());
    }
  }, [open]);

  const handleSendFriendRequest = async (result: SearchResult) => {
    setSendingTo(result.user_id);
    try {
      await addFriend({
        name: result.display_name || 'User',
        friendUserId: result.user_id,
        status: 'pending',
      });
      setSentIds(prev => new Set(prev).add(result.user_id));
      toast({
        title: 'Friend request sent! 🎉',
        description: `Request sent to ${result.display_name}`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send request',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSendingTo(null);
    }
  };

  const handleSendInvite = async () => {
    if (!email.trim() && !phone.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const inviterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'A friend';

      if (email.trim()) {
        const { error } = await supabase.functions.invoke('send-friend-invite', {
          body: { email: email.trim(), inviterName, inviterUserId: user?.id },
        });
        if (error) throw error;
      }

      addFriend({
        name: email ? email.split('@')[0] : phone.trim(),
        email: email.trim() || undefined,
        status: 'invited',
      });

      toast({
        title: 'Invitation sent! 🎉',
        description: email ? `We've sent an invite to ${email}` : `Invite recorded for ${phone}`,
      });

      setEmail('');
      setPhone('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Failed to send invite',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: 'Link copied!',
      description: 'Share this link with your friends',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-0">
          <DialogTitle className="font-display text-base">Add Friends</DialogTitle>
        </DialogHeader>

        <div className="w-full space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="friend@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                className="h-9 pl-9 text-sm"
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                className="h-9 pl-9 text-sm"
              />
            </div>

            <Button onClick={handleSendInvite} disabled={(!email.trim() && !phone.trim()) || isSending} size="sm" className="w-full h-9 text-xs">
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send Invite'}
            </Button>
          </div>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">Or share link</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input value={inviteLink} readOnly className="h-9 bg-muted/50 text-xs flex-1" />
            <Button variant="outline" onClick={handleCopyLink} size="sm" className="h-9 px-3 shrink-0">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export default InviteFriendDialog;
