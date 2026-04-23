import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowLeft, Sparkles, Users, Tag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { ACTIVITY_CONFIG, VIBE_CONFIG, getActivitiesByVibe, getAllVibes, ActivityType, TimeSlot } from '@/types/planner';
import { useOpenInvites } from '@/hooks/useOpenInvites';
import { useAuth } from '@/hooks/useAuth';
import { usePods } from '@/hooks/usePods';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Step = 'describe' | 'audience' | 'send' | 'confirm';

interface OpenInviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SLOT_OPTIONS: { value: TimeSlot; label: string; range: string }[] = [
  { value: 'late-morning', label: 'Morning', range: '10am – 12pm' },
  { value: 'early-afternoon', label: 'Lunch', range: '12pm – 2pm' },
  { value: 'late-afternoon', label: 'Afternoon', range: '2pm – 5pm' },
  { value: 'evening', label: 'Evening', range: '5pm – 9pm' },
  { value: 'late-night', label: 'Late Night', range: '9pm+' },
];

export function OpenInviteSheet({ open, onOpenChange }: OpenInviteSheetProps) {
  const { user } = useAuth();
  const { create } = useOpenInvites();
  const { pods } = usePods();
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !user?.id) return;
    supabase
      .from('profiles')
      .select('interests')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setInterests((data?.interests as string[]) || []));
  }, [open, user?.id]);

  const [step, setStep] = useState<Step>('describe');
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [date, setDate] = useState<Date>(addDays(new Date(), 1));
  const [slot, setSlot] = useState<TimeSlot>('evening');
  const [notes, setNotes] = useState('');
  const [audienceType, setAudienceType] = useState<'all_friends' | 'pod' | 'interest'>('all_friends');
  const [audienceRef, setAudienceRef] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep('describe');
    setActivity(null);
    setDate(addDays(new Date(), 1));
    setSlot('evening');
    setNotes('');
    setAudienceType('all_friends');
    setAudienceRef(null);
    setSubmitting(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 250);
  };

  const activityLabel = activity ? ACTIVITY_CONFIG[activity].label : '';
  const activityEmoji = activity ? ACTIVITY_CONFIG[activity].icon : '✨';

  const audienceLabel = useMemo(() => {
    if (audienceType === 'all_friends') return 'All friends';
    if (audienceType === 'pod') {
      const pod = pods.find((p) => p.id === audienceRef);
      return pod ? `${pod.emoji || '💜'} ${pod.name}` : 'A pod';
    }
    if (audienceType === 'interest' && audienceRef) return `Friends into ${audienceRef}`;
    return 'Choose audience';
  }, [audienceType, audienceRef, pods]);

  const handleSubmit = async () => {
    if (!user?.id || !activity) return;
    setSubmitting(true);
    const title = `${activityEmoji} ${activityLabel}`;
    const result = await create({
      title,
      activity,
      date: date.toISOString(),
      time_slot: slot,
      duration: 90,
      notes: notes.trim() || null,
      audience_type: audienceType,
      audience_ref: audienceType === 'all_friends' ? null : audienceRef,
    });
    setSubmitting(false);
    if (!result) {
      toast.error('Could not send your invite');
      return;
    }
    setStep('confirm');
  };

  const canContinueDescribe = !!activity;
  const canContinueAudience =
    audienceType === 'all_friends' ||
    (audienceType === 'pod' && !!audienceRef) ||
    (audienceType === 'interest' && !!audienceRef);

  return (
    <Drawer open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            {step !== 'describe' && step !== 'confirm' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setStep(step === 'audience' ? 'describe' : step === 'send' ? 'audience' : 'describe')
                }
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DrawerTitle className="flex-1">
              {step === 'describe' && 'Find someone to join you'}
              {step === 'audience' && 'Who should see this?'}
              {step === 'send' && 'Ready to send?'}
              {step === 'confirm' && 'Invite sent ✨'}
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          <AnimatePresence mode="wait">
            {step === 'describe' && (
              <motion.div
                key="describe"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    What's the vibe?
                  </p>
                  <div className="space-y-3">
                    {getAllVibes().map((vibe) => {
                      const acts = getActivitiesByVibe(vibe);
                      if (!acts.length) return null;
                      return (
                        <div key={vibe}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                            {VIBE_CONFIG[vibe].emoji} {VIBE_CONFIG[vibe].label}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {acts.map((a) => {
                              const cfg = ACTIVITY_CONFIG[a];
                              const selected = activity === a;
                              return (
                                <button
                                  key={a}
                                  onClick={() => setActivity(a)}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                    selected
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border hover:border-primary/30 hover:bg-primary/5'
                                  )}
                                >
                                  <span>{cfg.emoji}</span>
                                  {cfg.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    When?
                  </p>
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="rounded-md border"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Time of day
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SLOT_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setSlot(s.value)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left transition-all',
                          slot === s.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/30'
                        )}
                      >
                        <p className="text-xs font-semibold">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.range}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Add a note (optional)
                  </p>
                  <Textarea
                    placeholder="Anything else? Where, who you're looking for..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </motion.div>
            )}

            {step === 'audience' && (
              <motion.div
                key="audience"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <button
                  onClick={() => {
                    setAudienceType('all_friends');
                    setAudienceRef(null);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                    audienceType === 'all_friends'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <Users className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">All friends</p>
                    <p className="text-[11px] text-muted-foreground">
                      Anyone connected with you can see this
                    </p>
                  </div>
                  {audienceType === 'all_friends' && <Check className="h-4 w-4 text-primary" />}
                </button>

                {pods.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                      A pod
                    </p>
                    <div className="space-y-1.5">
                      {pods.map((p) => {
                        const selected = audienceType === 'pod' && audienceRef === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setAudienceType('pod');
                              setAudienceRef(p.id);
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all',
                              selected
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/30'
                            )}
                          >
                            <span className="text-lg">{p.emoji || '💜'}</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {p.memberUserIds.length} member{p.memberUserIds.length === 1 ? '' : 's'}
                              </p>
                            </div>
                            {selected && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {interests.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
                      Friends into…
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {interests.map((tag) => {
                        const selected = audienceType === 'interest' && audienceRef === tag;
                        return (
                          <button
                            key={tag}
                            onClick={() => {
                              setAudienceType('interest');
                              setAudienceRef(tag);
                            }}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/30'
                            )}
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'send' && (
              <motion.div
                key="send"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="rounded-2xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activityEmoji}</span>
                    <div>
                      <p className="text-base font-semibold">{activityLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(date, 'EEEE, MMM d')} ·{' '}
                        {SLOT_OPTIONS.find((s) => s.value === slot)?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{audienceLabel}</span>
                  </div>
                  {notes && (
                    <p className="text-xs text-muted-foreground italic border-t border-border pt-2">
                      "{notes}"
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">How this works</p>
                  <p>
                    First friend to claim it locks in a confirmed plan with you. The invite expires
                    in 48 hours either way.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-3"
              >
                <div className="text-5xl">{activityEmoji}</div>
                <div>
                  <p className="text-base font-semibold">Out into the world</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll let you know when someone bites.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="pt-2">
          {step === 'describe' && (
            <Button onClick={() => setStep('audience')} disabled={!canContinueDescribe}>
              Continue
            </Button>
          )}
          {step === 'audience' && (
            <Button onClick={() => setStep('send')} disabled={!canContinueAudience}>
              Continue
            </Button>
          )}
          {step === 'send' && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Send to {audienceLabel.toLowerCase()}
                </>
              )}
            </Button>
          )}
          {step === 'confirm' && <Button onClick={close}>Done</Button>}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
