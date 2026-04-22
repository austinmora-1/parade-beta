import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, LayoutDashboard, Calendar, Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFriendsStore } from '@/stores/friendsStore';
import { usePlansStore } from '@/stores/plansStore';

interface WalkthroughStep {
  icon: React.ReactNode;
  title: string;
  message: string;
  emoji: string;
  tip?: string;
}

const STEPS: WalkthroughStep[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Your Home Base",
    message: "This is your dashboard — your command center. Set your vibe and weekly intentions, see which friends are around, drop a quick plan, and check what's coming up — all in one place.",
    emoji: "🏠",
    tip: "Tap a friend in the vibe strip to start staging a plan with them.",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Making Plans",
    message: "Head to the Plans page for a swipeable week-by-week view of your schedule. Tap '+ New Plan' to launch the guided planner — pick friends, a vibe, and a time slot, and we'll surface who's free nearby.",
    emoji: "📅",
    tip: "Connect Google or Apple Calendar to sync events automatically every 2 hours.",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Trips & Visits",
    message: "Head to the Trips page to log upcoming travel or see when friends are visiting your city. Add a trip with destination and dates, and Parade automatically updates your location status and surfaces friends nearby so you can plan meetups.",
    emoji: "✈️",
    tip: "Not sure when to go? Start a Trip Proposal and vote on dates with friends before committing.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Your Social Health",
    message: "Parade helps you stay intentional about your social life. During onboarding you set your baseline preferences — preferred days, social cap, and the vibes you're craving. Each week, we'll help you check in on your social battery and set some intentions for the week to keep you on track.",
    emoji: "💛",
    tip: "Tap 'Weekly Intentions' on the dashboard every Sunday to recalibrate for the week ahead.",
  },
];

interface EllyWalkthroughProps {
  onComplete?: () => void;
}

export function EllyWalkthrough({ onComplete }: EllyWalkthroughProps) {
  const { user } = useAuth();
  const friendCount = useFriendsStore((s) => s.friends.length);
  const planCount = usePlansStore((s) => s.plans.length);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  // Only surface the walkthrough on a TRULY empty dashboard — no friends and
  // no plans. Once the user has any signal of activity, the tour gets in the
  // way more than it helps.
  useEffect(() => {
    if (!user) return;
    if (friendCount > 0 || planCount > 0) return;

    let cancelled = false;

    async function checkWalkthrough() {
      const { data } = await supabase
        .from('profiles')
        .select('walkthrough_completed')
        .eq('user_id', user!.id)
        .single();

      if (cancelled) return;

      if (data && !data.walkthrough_completed) {
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    }

    checkWalkthrough();
    return () => { cancelled = true; };
  }, [user, friendCount, planCount]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = async () => {
    setVisible(false);
    if (user) {
      await supabase
        .from('profiles')
        .update({ walkthrough_completed: true })
        .eq('user_id', user.id);
    }
    localStorage.removeItem('parade-walkthrough-seen');
    onComplete?.();
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 bottom-24 z-[61] mx-auto max-w-md md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:inset-x-0"
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              {/* Progress bar */}
              <div className="h-1 w-full bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: `${(step / STEPS.length) * 100}%` }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6">
                {/* Step indicator */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Step {step + 1} of {STEPS.length}
                  </p>
                </div>

                {/* Content */}
                <motion.div
                  key={`content-${step}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                >
                  <h3 className="font-display text-lg font-bold mb-2">
                    {current.emoji} {current.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {current.message}
                  </p>

                  {/* Tip callout */}
                  {current.tip && (
                    <div className="mt-3 flex gap-2 rounded-lg bg-primary/10 p-3">
                      <Sparkles className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        <span className="font-semibold text-primary">Tip:</span> {current.tip}
                      </p>
                    </div>
                  )}

                </motion.div>

                {/* Actions */}
                <div className="mt-5 flex items-center justify-between">
                  <button
                    onClick={handleDismiss}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip tour
                  </button>
                  <div className="flex items-center gap-2">
                    {step > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep(s => s - 1)}
                        className="h-8 px-3 text-xs"
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleNext}
                      className="h-8 gap-1.5 px-4 text-xs"
                    >
                      {isLast ? "Let's go!" : 'Next'}
                      {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Step dots */}
                <div className="mt-4 flex justify-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-200",
                        i === step
                          ? "w-6 bg-primary"
                          : i < step
                            ? "w-1.5 bg-primary/40"
                            : "w-1.5 bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
