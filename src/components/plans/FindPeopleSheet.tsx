import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Users as UsersIcon, Tag, Sparkles, Calendar as CalendarIcon, MapPin, Send, Plane, Quote, CheckCircle2,
} from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Plan, ACTIVITY_CONFIG, ActivityType, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { useOpenInvites, type OpenInviteAudienceType } from '@/hooks/useOpenInvites';
import { usePods } from '@/hooks/usePods';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { AnchorStep } from './findpeople/AnchorStep';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export interface TripContext {
  tripId: string;
  location: string | null;
  startDate: string; // yyyy-mm-dd
  endDate: string;   // yyyy-mm-dd
}

interface FindPeopleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, skip anchor + describe and prefill from this trip. */
  tripContext?: TripContext;
}

type Step = 'anchor' | 'describe' | 'audience' | 'preview' | 'success';

const TIME_SLOTS: TimeSlot[] = ['early-morning', 'late-morning', 'early-afternoon', 'late-afternoon', 'evening', 'late-night'];

const QUICK_ACTIVITIES: { id: ActivityType; label: string; icon: string }[] = [
  { id: 'coffee', label: 'Coffee', icon: '☕' },
  { id: 'drinks', label: 'Drinks', icon: '🍹' },
  { id: 'dinner', label: 'Dinner', icon: '🍝' },
  { id: 'lunch', label: 'Lunch', icon: '🥗' },
  { id: 'walk', label: 'Walk', icon: '🚶' } as any,
  { id: 'gym', label: 'Workout', icon: '💪' } as any,
];

export function FindPeopleSheet({ open, onOpenChange, tripContext }: FindPeopleSheetProps) {
  const { create } = useOpenInvites();
  const { pods } = usePods();
  const { friends } = usePlannerStore();
  const viewport = useVisualViewport();
  const { profile } = useCurrentUserProfile();
  const senderFirstName = profile?.first_name || profile?.display_name?.split(' ')[0] || 'A friend';

  const [step, setStep] = useState<Step>('anchor');
  const [anchorPlan, setAnchorPlan] = useState<Plan | null>(null);

  // Describe-step fields
  const [title, setTitle] = useState('');
  const [activity, setActivity] = useState<string>('coffee');
  const [date, setDate] = useState<Date>(new Date());
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('evening');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Audience
  const [audienceType, setAudienceType] = useState<OpenInviteAudienceType>('all_friends');
  const [audienceRef, setAudienceRef] = useState<string | null>(null);

  const [sending, setSending] = useState(false);

  const tripDateBounds = useMemo(() => {
    if (!tripContext) return null;
    return {
      from: new Date(tripContext.startDate + 'T00:00:00'),
      to: new Date(tripContext.endDate + 'T00:00:00'),
    };
  }, [tripContext]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setAnchorPlan(null);
    setSending(false);
    setAudienceType('all_friends');
    setAudienceRef(null);
    setNotes('');

    if (tripContext) {
      // Skip anchor + describe; prefill from trip and jump to audience.
      setLocation(tripContext.location || '');
      setDate(new Date(tripContext.startDate + 'T00:00:00'));
      setTimeSlot('evening');
      setActivity('coffee');
      setTitle(`Anyone free in ${tripContext.location || 'town'}?`);
      setStep('audience');
    } else {
      setStep('anchor');
      setTitle('');
      setActivity('coffee');
      setDate(new Date());
      setTimeSlot('evening');
      setLocation('');
    }
  }, [open, tripContext]);

  const handleSelectExistingPlan = (plan: Plan) => {
    setAnchorPlan(plan);
    setTitle(plan.title);
    setActivity(plan.activity);
    setDate(plan.date);
    setTimeSlot(plan.timeSlot);
    setLocation(typeof plan.location === 'string' ? plan.location : (plan.location?.name || ''));
    setNotes(plan.notes || '');
    setStep('audience');
  };

  const handleSelectNew = () => {
    setAnchorPlan(null);
    setStep('describe');
  };

  const canSubmitDescribe = title.trim().length > 0 && !!activity && !!timeSlot;

  const audienceLabel = useMemo(() => {
    if (audienceType === 'all_friends') return 'All friends';
    if (audienceType === 'pod' && audienceRef) {
      const pod = pods.find(p => p.id === audienceRef);
      return pod ? `${pod.emoji} ${pod.name}` : 'Pod';
    }
    if (audienceType === 'interest' && audienceRef) return `Interested in ${audienceRef}`;
    return 'Friends';
  }, [audienceType, audienceRef, pods]);

  const estimatedReach = useMemo(() => {
    const connected = friends.filter(f => f.status === 'connected');
    if (audienceType === 'all_friends') return connected.length;
    if (audienceType === 'pod' && audienceRef) {
      const pod = pods.find(p => p.id === audienceRef);
      return pod?.memberUserIds.length || 0;
    }
    return Math.max(1, Math.round(connected.length * 0.3));
  }, [audienceType, audienceRef, friends, pods]);

  const handleSend = async () => {
    setSending(true);
    try {
      const payload = {
        title: title.trim() || (ACTIVITY_CONFIG[activity as ActivityType]?.label ?? 'Hangout'),
        activity,
        date: date.toISOString(),
        time_slot: timeSlot,
        location: location.trim() || (tripContext?.location ?? null),
        notes: notes.trim() || null,
        audience_type: audienceType,
        audience_ref: audienceRef,
        plan_id: anchorPlan?.id ?? null,
        trip_id: tripContext?.tripId ?? null,
      };
      const result = await create(payload);
      if (!result) {
        toast.error('Could not send invite. Try again?');
        setSending(false);
        return;
      }
      // Show inline success state instead of toast
      setSending(false);
      setStep('success');
    } catch (err) {
      console.error('[FindPeopleSheet] send error', err);
      toast.error('Something went wrong');
      setSending(false);
    }
  };

  const stepTitle =
    step === 'anchor' ? 'Find people'
    : step === 'describe' ? 'Describe the plan'
    : step === 'audience' ? 'Who should see this?'
    : step === 'preview' ? 'Send open invite'
    : 'Live!';

  const goBack = () => {
    if (tripContext) {
      // Trip mode: only audience ↔ preview, no back from audience.
      if (step === 'preview') setStep('audience');
      else onOpenChange(false);
      return;
    }
    if (step === 'preview') setStep('audience');
    else if (step === 'audience') setStep(anchorPlan ? 'anchor' : 'describe');
    else if (step === 'describe') setStep('anchor');
  };

  const showBack = !(step === 'anchor' || (tripContext && step === 'audience'));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[90vh]"
        style={viewport ? { maxHeight: `${Math.min(viewport.height * 0.9, window.innerHeight * 0.9)}px` } : undefined}
      >
        <DrawerHeader className="pb-2 relative">
          {showBack && (
            <button
              onClick={goBack}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <DrawerTitle className="text-center text-sm font-semibold px-8">
            {stepTitle}
          </DrawerTitle>
        </DrawerHeader>

        {/* Trip-mode banner */}
        {tripContext && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-availability-away/10 border border-availability-away/20 px-3 py-2">
            <Plane className="h-3.5 w-3.5 text-availability-away shrink-0" />
            <p className="text-[11px] text-foreground">
              Anchored to your trip in <span className="font-semibold">{tripContext.location || 'destination'}</span>
            </p>
          </div>
        )}

        {/* Anchor-plan banner */}
        {anchorPlan && step !== 'anchor' && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-[11px] text-foreground truncate">
              Filling: <span className="font-semibold">{anchorPlan.title}</span>
            </p>
          </div>
        )}

        <div className="px-4 pb-2 overflow-y-auto flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {step === 'anchor' && (
              <AnchorStep onSelectPlan={handleSelectExistingPlan} onSelectNew={handleSelectNew} />
            )}

            {step === 'describe' && (
              <motion.div
                key="describe"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Coffee tomorrow morning?"
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</label>
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    {QUICK_ACTIVITIES.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setActivity(a.id)}
                        className={cn(
                          'rounded-lg border px-2 py-1.5 text-xs transition-all flex items-center gap-1 justify-center',
                          activity === a.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/30'
                        )}
                      >
                        <span>{a.icon}</span>
                        <span className="truncate">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="mt-1 w-full h-9 justify-start gap-2 text-xs font-normal">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {format(date, 'EEE, MMM d')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={d => d && setDate(d)}
                          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</label>
                    <select
                      value={timeSlot}
                      onChange={e => setTimeSlot(e.target.value as TimeSlot)}
                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {TIME_SLOTS.map(s => (
                        <option key={s} value={s}>{TIME_SLOT_LABELS[s].label} ({TIME_SLOT_LABELS[s].time})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location (optional)</label>
                  <Input
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="A spot, neighborhood, or TBD"
                    className="mt-1 h-9 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Anything else…"
                    rows={2}
                    className="mt-1 text-sm resize-none"
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
                className="space-y-2"
              >
                {tripContext && tripDateBounds && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Day during trip</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="mt-1 w-full h-9 justify-start gap-2 text-xs font-normal">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {format(date, 'EEE, MMM d')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={d => d && setDate(d)}
                          disabled={(d) => d < tripDateBounds.from || d > tripDateBounds.to}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <button
                  onClick={() => { setAudienceType('all_friends'); setAudienceRef(null); }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                    audienceType === 'all_friends'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <UsersIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">All friends</p>
                    <p className="text-[11px] text-muted-foreground">Broadcast to everyone connected</p>
                  </div>
                </button>

                {pods.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-1">Pods</p>
                    {pods.map(pod => {
                      const selected = audienceType === 'pod' && audienceRef === pod.id;
                      return (
                        <button
                          key={pod.id}
                          onClick={() => { setAudienceType('pod'); setAudienceRef(pod.id); }}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all',
                            selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
                          )}
                        >
                          <span className="text-base shrink-0">{pod.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pod.name}</p>
                            <p className="text-[11px] text-muted-foreground">{pod.memberUserIds.length} member{pod.memberUserIds.length === 1 ? '' : 's'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => { setAudienceType('interest'); setAudienceRef('coffee'); }}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                    audienceType === 'interest'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <Tag className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">By interest</p>
                    {audienceType === 'interest' ? (
                      <Input
                        value={audienceRef || ''}
                        onChange={e => setAudienceRef(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="e.g. running, art, music"
                        className="mt-1 h-7 text-xs"
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Friends with a matching tag</p>
                    )}
                  </div>
                </button>
              </motion.div>
            )}

            {step === 'preview' && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                  <p className="text-sm font-semibold">{title || 'Hangout'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-3 w-3" />
                    {format(date, 'EEE, MMM d')} · {TIME_SLOT_LABELS[timeSlot].label}
                  </p>
                  {location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs">
                  <p className="text-foreground">
                    Sending to <span className="font-semibold">{audienceLabel}</span>
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    ~{estimatedReach} {estimatedReach === 1 ? 'friend' : 'friends'} likely to see this · expires in 48 hours
                  </p>
                </div>

                {anchorPlan && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    First friend to claim will be added to your existing plan.
                  </p>
                )}
                {tripContext && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    First friend to claim becomes a travel companion on this trip.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DrawerFooter className="pt-2">
          {step === 'describe' && (
            <Button onClick={() => setStep('audience')} disabled={!canSubmitDescribe} className="w-full">
              Continue
            </Button>
          )}
          {step === 'audience' && (
            <Button
              onClick={() => setStep('preview')}
              disabled={audienceType === 'interest' && !(audienceRef && audienceRef.trim())}
              className="w-full"
            >
              Preview
            </Button>
          )}
          {step === 'preview' && (
            <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send open invite
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default FindPeopleSheet;
