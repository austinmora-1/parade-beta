import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Calendar, Clock, Users, MessageCircle, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const WALKTHROUGH_KEY = 'parade-walkthrough-seen';

interface WalkthroughStep {
  icon: React.ReactNode;
  title: string;
  message: string;
  emoji: string;
}

const STEPS: WalkthroughStep[] = [
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Hey, I'm Elly! 👋",
    message: "Welcome to Parade! I'm your AI planning assistant. Let me give you a quick tour of everything you can do here.",
    emoji: "✨",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Your Week at a Glance",
    message: "The Week Overview shows your entire week — what slots are free, busy, or have plans. Tap any day to see details or quickly set your availability.",
    emoji: "📅",
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: "Set Your Availability",
    message: "Head to the Availability tab to mark when you're free. Your friends can see when you're available, making it easy to find the perfect time to hang out.",
    emoji: "⏰",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Connect with Friends",
    message: "Add friends on the Friends tab — search by name or share your invite link. Once connected, you'll see each other's availability and can plan together.",
    emoji: "👯",
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "Chat & Plan Together",
    message: "Use Messages to chat with friends. You can mention @Elly in any conversation and I'll help coordinate plans, find free times, and create events for everyone!",
    emoji: "💬",
  },
  {
    icon: <MapPin className="h-5 w-5" />,
    title: "Vibes & Location",
    message: "Set your current vibe and location status so friends know what you're up for. Whether you're feeling social, chill, or athletic — it helps find the right hangout.",
    emoji: "📍",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "You're All Set!",
    message: "That's the basics! Remember, you can always ask me for help — just tap the Elly widget on your dashboard or mention @Elly in any chat. Let's make some plans! 🎉",
    emoji: "🚀",
  },
];

interface EllyWalkthroughProps {
  onComplete?: () => void;
}

export function EllyWalkthrough({ onComplete }: EllyWalkthroughProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(WALKTHROUGH_KEY);
    if (!seen) {
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
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
