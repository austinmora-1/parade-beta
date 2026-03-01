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
import { SignedImage } from '@/components/ui/SignedImage';
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
      // Store the file path (bucket:path format) instead of public URL
      const storagePath = `storage:vibe-media:${path}`;
      setMediaUrl(storagePath);
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
      <DialogContent className="max-w-md mx-auto sm:rounded-2xl p-4 gap-0 max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-base">Send a Vibe ✨</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Vibe type pills */}
          <div>
            <div className="flex flex-wrap gap-1">
              {vibeTypes.map(type => {
                const config = VIBE_CONFIG[type];
                const isSelected = vibeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setVibeType(type)}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                      isSelected
                        ? "text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                    style={isSelected ? { backgroundColor: vibeColors[type] } : undefined}
                  >
                    <span>{config.icon}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => setVibeType('custom')}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border border-dashed",
                  vibeType === 'custom'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                )}
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Custom</span>
              </button>
            </div>

            <AnimatePresence>
              {vibeType === 'custom' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-1.5 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-1">
                    {customTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        #{tag}
                        <button
                          onClick={() => setCustomTags(prev => prev.filter(t => t !== tag))}
                          className="rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
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
                      className="h-6 w-24 rounded-full bg-muted px-2 text-[11px] outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Message */}
          <div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="What are you up to? (optional)"
              maxLength={280}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right -mt-0.5">{message.length}/280</p>
          </div>

          {/* Attachments row — photo, gif, location inline */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            {mediaUrl ? (
              <div className="relative">
                <SignedImage src={mediaUrl} alt="Vibe" className="h-14 w-14 rounded-lg object-cover border border-border" />
                <button
                  onClick={() => { setMediaUrl(null); setMediaType(null); }}
                  className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground h-4 w-4 flex items-center justify-center"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1 h-7 text-[11px] px-2"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                  Photo
                </Button>
                <GifPicker onGifSelect={(url) => { setMediaUrl(url); setMediaType('gif'); }}>
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-[11px] px-2">
                    <span className="text-[10px] font-bold">GIF</span>
                  </Button>
                </GifPicker>
              </>
            )}
            {location ? (
              <div className="flex items-center gap-1 rounded-full bg-primary/10 pl-2 pr-1 py-0.5 text-[11px] text-primary font-medium">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate max-w-[120px]">{location.name}</span>
                <button onClick={() => setLocation(null)} className="rounded-full p-0.5 hover:bg-primary/20">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ) : (
              <VibeLocationInput value={location} onChange={setLocation} compact />
            )}
          </div>

          {/* Target selection */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Send to</label>
            <div className="flex gap-1">
              {([
                { type: 'broadcast' as TargetType, label: 'All Friends', icon: Globe, count: connectedFriends.length },
                { type: 'pod' as TargetType, label: 'Pod', icon: Shield, count: podFriends.length },
                { type: 'selected' as TargetType, label: 'Select', icon: Users, count: null },
              ]).map(({ type, label, icon: Icon, count }) => (
                <button
                  key={type}
                  onClick={() => setTargetType(type)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all border",
                    targetType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  {count !== null && <span className="text-[10px] opacity-60">({count})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Friend picker */}
          <AnimatePresence>
            {targetType === 'selected' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-lg border border-border p-1.5">
                  {connectedFriends.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-1.5">No connected friends yet</p>
                  ) : (
                    connectedFriends.map(friend => {
                      const isSelected = selectedFriendIds.includes(friend.friendUserId!);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => toggleFriend(friend.friendUserId!)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors text-left",
                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <Check className="h-2 w-2 text-primary-foreground" />}
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

          {/* Send */}
          <Button
            onClick={handleSend}
            disabled={sending || recipientCount === 0}
            className="w-full gap-2 h-9"
            size="sm"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send to {recipientCount} friend{recipientCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
