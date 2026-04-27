import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Send, Calendar, Clock, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { usePlannerStore } from '@/stores/plannerStore';
import { supabase } from '@/integrations/supabase/client';
import { TIME_SLOT_LABELS, type TimeSlot, type ActivityType } from '@/types/planner';
import type { OpenWindow } from '@/hooks/useOpenWindows';

const QUICK_ACTIVITIES: { id: ActivityType; emoji: string; label: string }[] = [
  { id: 'drinks', emoji: '🍹', label: 'Drinks' },
  { id: 'get-food', emoji: '🍽️', label: 'Food' },
  { id: 'hanging-out', emoji: '🤙', label: 'Hangout' },
  { id: 'concert', emoji: '🎵', label: 'Concert' },
  { id: 'movies', emoji: '🎥', label: 'Movies' },
  { id: 'gym', emoji: '🏋️', label: 'Gym' },
  { id: 'video-games', emoji: '🎮', label: 'Games' },
  { id: 'park', emoji: '🌳', label: 'Park' },
];


interface RecommendedPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  window: OpenWindow | null;
}

export function RecommendedPlanDialog({ open, onOpenChange, window: w }: RecommendedPlanDialogProps) {
  const { proposePlan, addPlan, userId } = usePlannerStore();
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [customActivity, setCustomActivity] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && w) {
      const friendNames = w.overlappingFriends.slice(0, 2).map((f) => f.name.split(' ')[0]);
      const suffix = w.overlappingFriends.length > 2 ? ` +${w.overlappingFriends.length - 2}` : '';
      const baseTitle = friendNames.length > 0
        ? `Hang with ${friendNames.join(', ')}${suffix}`
        : `Open hang — ${w.dayLabel}`;
      setTitle(baseTitle);
      setTitleEdited(false);
      setActivity(null);
      setCustomActivity('');
      setNote('');
      setSending(false);
    }
  }, [open, w]);

  // Auto-update title when activity changes (unless user manually edited).
  useEffect(() => {
    if (!open || !w || titleEdited) return;
    const friendNames = w.overlappingFriends.slice(0, 2).map((f) => f.name.split(' ')[0]);
    const suffix = w.overlappingFriends.length > 2 ? ` +${w.overlappingFriends.length - 2}` : '';
    const friendsPart = friendNames.length > 0 ? ` with ${friendNames.join(', ')}${suffix}` : '';
    if (activity) {
      const label = QUICK_ACTIVITIES.find((a) => a.id === activity)?.label ?? '';
      setTitle(`${label}${friendsPart || ` — ${w.dayLabel}`}`);
    } else {
      setTitle(friendNames.length > 0 ? `Hang${friendsPart}` : `Open hang — ${w.dayLabel}`);
    }
  }, [activity, open, w, titleEdited]);

  if (!w) return null;

  const slot = w.slots[0] as TimeSlot;
  const hasFriends = w.overlappingFriends.length > 0;
  const effectiveActivity = customActivity.trim() || activity || 'hanging-out';

  const handleSend = async () => {
    if (sending) return;
    setSending(true);

    try {
      if (hasFriends) {
        const first = w.overlappingFriends[0];
        await proposePlan({
          recipientFriendId: first.userId,
          activity: effectiveActivity,
          date: w.date,
          timeSlot: slot,
          title: title.trim() || undefined,
          note: note.trim() || undefined,
        });

        if (w.overlappingFriends.length > 1 && userId) {
          const { data: latestPlan } = await supabase
            .from('plans')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'proposed')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (latestPlan) {
            const extras = w.overlappingFriends.slice(1).map((f) => ({
              plan_id: latestPlan.id,
              friend_id: f.userId,
              status: 'invited',
              role: 'participant',
            }));
            await supabase.from('plan_participants').insert(extras);
          }
        }

        confetti({
          particleCount: 80,
          spread: 55,
          origin: { y: 0.75 },
          colors: ['#3D8C6C', '#FF6B5B', '#F59E0B', '#8B5CF6', '#3B82F6'],
          scalar: 0.9,
        });
        const names = w.overlappingFriends
          .slice(0, 3)
          .map((f) => f.name.split(' ')[0])
          .join(', ');
        toast.success(`Plan suggestion sent to ${names}! 🎉`);
      } else {
        await addPlan({
          title: title.trim() || `Open hang — ${w.dayLabel}`,
          activity: effectiveActivity,
          date: w.date,
          timeSlot: slot,
          duration: 60,
          notes: note.trim() || undefined,
          status: 'confirmed',
          participants: [],
        });
        toast.success('Plan added!');
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('[RecommendedPlanDialog] send failed', err);
      toast.error(err?.message || 'Failed to send plan');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hasFriends ? 'Suggest this plan' : 'Make this plan'}</DialogTitle>
          <DialogDescription className="sr-only">
            Pre-filled plan for {w.dayLabel} {w.startLabel}–{w.endLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pre-filled summary */}
          <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{w.dayLabel}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{format(w.date, 'MMM d')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{w.startLabel}–{w.endLabel}</span>
              <span className="text-muted-foreground">· {TIME_SLOT_LABELS[slot]?.label}</span>
            </div>
            {hasFriends && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <div className="flex -space-x-1.5">
                  {w.overlappingFriends.slice(0, 4).map((f) => (
                    <Avatar key={f.userId} className="h-6 w-6 ring-1 ring-background">
                      {f.avatar && <AvatarImage src={f.avatar} alt={f.name} />}
                      <AvatarFallback className="text-[10px]">
                        {f.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-muted-foreground text-xs">
                  {w.overlappingFriends.length} {w.overlappingFriends.length === 1 ? 'friend' : 'friends'} free
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleEdited(true);
              }}
              placeholder="What are we doing?"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add activity (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIVITIES.map((a) => {
                const selected = activity === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActivity(selected ? null : a.id)}
                    className={
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ' +
                      (selected
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground')
                    }
                  >
                    <span>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
              <div
                className={
                  'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors ' +
                  (customActivity.trim()
                    ? 'border-accent/60 bg-accent/15 text-foreground'
                    : 'border-dashed border-accent/40 bg-accent/5 text-accent hover:border-accent/60')
                }
              >
                <span>✏️</span>
                <input
                  type="text"
                  value={customActivity}
                  onChange={(e) => {
                    setCustomActivity(e.target.value);
                    if (e.target.value.trim()) setActivity(null);
                  }}
                  placeholder="Custom"
                  className="w-14 bg-transparent text-xs placeholder:text-accent/60 focus:w-20 focus:outline-none transition-[width]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a quick message…"
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {hasFriends ? 'Send suggestion' : 'Add plan'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
