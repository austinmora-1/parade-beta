import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePlannerStore } from '@/stores/plannerStore';
import { useAuth } from '@/hooks/useAuth';
import { useVibes, SendVibePayload } from '@/hooks/useVibes';
import { VIBE_CONFIG, VibeType } from '@/types/planner';
import { Send, ImagePlus, MapPin, Users, Globe, Shield, X, Plus, Loader2, Check } from 'lucide-react';
import { GifPicker } from '@/components/chat/GifPicker';
import { VibeLocationInput, VibeLocation } from '@/components/vibes/VibeLocationInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface SendVibeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetType = 'broadcast' | 'pod' | 'selected';

export function SendVibeDialog({ open, onOpenChange }: SendVibeDialogProps) {
  const { user } = useAuth();
  const { friends } = usePlannerStore();
  const { sendVibe } = useVibes();

  const [vibeType, setVibeType] = useState<VibeType | 'custom'>('social');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('broadcast');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'gif' | null>(null);
  const [location, setLocation] = useState<VibeLocation | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connectedFriends = friends.filter(f => f.status === 'connected' && f.friendUserId);
  const podFriends = connectedFriends.filter(f => f.isPodMember);

  const vibeTypes = (Object.keys(VIBE_CONFIG) as VibeType[]).filter(t => t !== 'custom');

  const vibeColors: Record<string, string> = {
    social: 'hsl(var(--vibe-social))',
    chill: 'hsl(var(--vibe-chill))',
    athletic: 'hsl(var(--vibe-athletic))',
    productive: 'hsl(var(--vibe-productive))',
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('vibe-media').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('vibe-media').getPublicUrl(path);
      setMediaUrl(publicUrl);
      setMediaType('image');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleFriend = (friendUserId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(friendUserId)
        ? prev.filter(id => id !== friendUserId)
        : [...prev, friendUserId]
    );
  };

  const handleSend = async () => {
    if (targetType === 'selected' && selectedFriendIds.length === 0) {
      toast.error('Select at least one friend');
      return;
    }

    setSending(true);
    const payload: SendVibePayload = {
      vibe_type: vibeType,
      custom_tags: vibeType === 'custom' && customTags.length > 0 ? customTags : undefined,
      message: message || undefined,
      media_url: mediaUrl || undefined,
      media_type: mediaType || undefined,
      location_name: location?.name || undefined,
      target_type: targetType,
      recipient_ids: targetType === 'selected' ? selectedFriendIds : undefined,
    };

    await sendVibe(payload);
    setSending(false);
    resetAndClose();
  };

  const resetAndClose = () => {
    setVibeType('social');
    setCustomTags([]);
    setCustomInput('');
    setMessage('');
    setTargetType('broadcast');
    setSelectedFriendIds([]);
    setMediaUrl(null);
    setMediaType(null);
    setLocation(null);
    onOpenChange(false);
  };

  const recipientCount =
    targetType === 'broadcast'
      ? connectedFriends.length
      : targetType === 'pod'
        ? podFriends.length
        : selectedFriendIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Send a Vibe ✨</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What's the vibe?</label>
            <div className="flex flex-wrap gap-1.5">
              {vibeTypes.map(type => {
                const config = VIBE_CONFIG[type];
                const isSelected = vibeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setVibeType(type)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                      isSelected
                        ? "text-primary-foreground shadow-md"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                    style={isSelected ? { backgroundColor: vibeColors[type] } : undefined}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
              {/* Custom vibe pill */}
              <button
                onClick={() => setVibeType('custom')}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all border-2 border-dashed",
                  vibeType === 'custom'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary"
                )}
              >
                <Plus className="h-3 w-3" />
                <span>Custom</span>
              </button>
            </div>

            {/* Custom tags input */}
            <AnimatePresence>
              {vibeType === 'custom' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {customTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        #{tag}
                        <button
                          onClick={() => setCustomTags(prev => prev.filter(t => t !== tag))}
                          className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      placeholder="type a vibe..."
                      value={customInput}
                      onChange={e => setCustomInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && customInput.trim()) {
                          e.preventDefault();
                          setCustomTags(prev => [...prev, customInput.trim().replace(/\s+/g, '')]);
                          setCustomInput('');
                        }
                      }}
                      className="h-7 w-28 rounded-full bg-muted px-2.5 text-xs outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message (optional)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What are you up to?"
              maxLength={280}
              rows={2}
              className="w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{message.length}/280</p>
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Photo (optional)</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {mediaUrl ? (
              <div className="relative inline-block">
                <img src={mediaUrl} alt="Vibe" className="h-24 w-24 rounded-xl object-cover border border-border" />
                <button
                  onClick={() => { setMediaUrl(null); setMediaType(null); }}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground h-5 w-5 flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  Add photo
                </Button>
                <GifPicker onGifSelect={(url) => { setMediaUrl(url); setMediaType('gif'); }}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <span className="text-xs font-bold">GIF</span>
                    Add GIF
                  </Button>
                </GifPicker>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Location (optional)</label>
            <VibeLocationInput value={location} onChange={setLocation} />
          </div>

          {/* Target selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Send to</label>
            <div className="flex gap-1.5">
              {([
                { type: 'broadcast' as TargetType, label: 'All Friends', icon: Globe, count: connectedFriends.length },
                { type: 'pod' as TargetType, label: 'Pod', icon: Shield, count: podFriends.length },
                { type: 'selected' as TargetType, label: 'Select', icon: Users, count: null },
              ]).map(({ type, label, icon: Icon, count }) => (
                <button
                  key={type}
                  onClick={() => setTargetType(type)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-xs font-medium transition-all border-2",
                    targetType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {count !== null && <span className="text-[10px] opacity-60">{count}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Friend picker for 'selected' */}
          <AnimatePresence>
            {targetType === 'selected' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                  {connectedFriends.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No connected friends yet</p>
                  ) : (
                    connectedFriends.map(friend => {
                      const isSelected = selectedFriendIds.includes(friend.friendUserId!);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => toggleFriend(friend.friendUserId!)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors text-left",
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <span className="truncate">{friend.name}</span>
                          {friend.isPodMember && (
                            <span className="ml-auto text-[10px] text-muted-foreground">pod</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={sending || recipientCount === 0}
            className="w-full gap-2"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send to {recipientCount} friend{recipientCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
