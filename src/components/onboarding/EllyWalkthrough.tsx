import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, LayoutDashboard, Calendar, Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    message: "This is your dashboard — your command center. See upcoming plans, weekly availability, friend activity, and your vibe status all in one place. Widgets are collapsible so you can customize your view.",
    emoji: "🏠",
    tip: "Tap any widget header to expand or collapse it.",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Creating Plans",
    message: "Tap '+ New Plan' on the dashboard or head to the Plans page to create hangouts. Pick friends, a time slot, and a location. Friends can also send you hang requests when they see you're free!",
    emoji: "📅",
    tip: "Share your availability link so anyone can request to hang with you.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Sharing Availability",
    message: "Set your weekly intentions and mark when you're free. Friends can see your availability and propose plans for open slots. The more you share, the easier it is to connect!",
    emoji: "🗓️",
    tip: "Set default work hours so your free time fills in automatically.",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Trips & Travel",
    message: "Heading somewhere? Add a trip and Parade will update your availability and location status automatically. Friends visiting your city — or vice versa — will get surfaced so you never miss a chance to meet up.",
    emoji: "✈️",
    tip: "Trip proposals let you vote on dates with friends before committing!",
  },
];

interface EllyWalkthroughProps {
  onComplete?: () => void;
}

export function EllyWalkthrough({ onComplete }: EllyWalkthroughProps) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;

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
  }, [user]);

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
                {/* Elly avatar + step icon */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      "bg-primary/10 text-primary"
                    )}>
                      {current.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Elly · Step {step + 1} of {STEPS.length}
                      </p>
                    </div>
                  </div>
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
