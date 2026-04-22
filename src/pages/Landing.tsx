import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Calendar, Users, Sparkles } from 'lucide-react';
import { ConfettiBackground } from '@/components/landing/ConfettiBackground';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function Landing() {
  const signupRef = useRef<HTMLDivElement>(null);
  const { scheme, setScheme } = useColorScheme();

  // Landing uses Coral primary scheme (V2 default)
  useEffect(() => {
    if (scheme !== 'coral') setScheme('coral');
  }, [scheme, setScheme]);

  const scrollToSignup = () => {
    signupRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className="relative min-h-screen bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Lexend', system-ui, sans-serif", fontWeight: 300 }}
    >
      {/* Soft confetti backdrop on cream */}
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-60">
        <ConfettiBackground count={70} />
      </div>

      {/* Hero — warm cream with subtle coral wash */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center px-5 sm:px-6">
        {/* Warm radial gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top, hsl(var(--primary-glow) / 0.25) 0%, transparent 55%), radial-gradient(ellipse at bottom right, hsl(var(--secondary) / 0.12) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="w-full"
          >
            {/* Brand mark */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full bg-secondary"
                aria-hidden
              />
              <span
                className="text-xs sm:text-sm tracking-[0.28em] uppercase text-secondary"
                style={{ fontFamily: "'Lexend', system-ui", fontWeight: 500 }}
              >
                Parade
              </span>
              <span
                className="inline-flex h-2.5 w-2.5 rounded-full bg-primary"
                aria-hidden
              />
            </div>

            {/* Display headline — Fraunces 900 */}
            <h1
              className="text-foreground leading-[1.02] tracking-[-0.02em] text-[44px] sm:text-6xl md:text-7xl"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 900 }}
            >
              Make plans
              <br />
              <span className="text-primary">actually happen.</span>
            </h1>

            {/* Sub-headline — Lexend body */}
            <p className="mt-6 text-foreground/75 text-base sm:text-lg md:text-xl leading-[1.7] max-w-xl mx-auto">
              Stop letting plans die in the group chat. Parade syncs your
              calendars so you can see who's free, who's nearby, and what's
              on deck — no more "wya" spirals.
            </p>

            {/* Primary CTA — coral */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={scrollToSignup}
                size="lg"
                className="text-base px-8 py-6 rounded-full shadow-md hover:shadow-lg transition-shadow"
              >
                Get started
              </Button>
              <Link
                to="/login"
                className="text-sm text-foreground/60 hover:text-foreground transition-colors underline-offset-4 hover:underline"
              >
                I already have an account
              </Link>
            </div>
          </motion.div>

          {/* Feature trio — green grounding accents */}
          <motion.div
            className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {[
              { icon: Calendar, label: 'Sync your calendars', tone: 'secondary' as const },
              { icon: Users, label: 'See who\u2019s free', tone: 'primary' as const },
              { icon: Sparkles, label: 'Plan in seconds', tone: 'secondary' as const },
            ].map(({ icon: Icon, label, tone }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/70 backdrop-blur-sm border border-border/60"
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                    tone === 'primary'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/10 text-secondary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className="text-sm text-foreground/80 text-left"
                  style={{ fontFamily: "'Lexend', system-ui", fontWeight: 400 }}
                >
                  {label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Scroll cue */}
          <motion.button
            onClick={scrollToSignup}
            className="mt-12 text-foreground/40 hover:text-foreground/70 transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            aria-label="Scroll to sign up"
          >
            <ChevronDown className="mx-auto h-6 w-6 animate-bounce" />
          </motion.button>
        </div>
      </section>

      {/* Signup CTA Section — softer cream card */}
      <section
        ref={signupRef}
        className="relative py-24 px-6"
        style={{ background: 'hsl(var(--muted) / 0.5)' }}
      >
        <div className="relative z-10 max-w-md mx-auto text-center">
          <img
            src="/icon-192.png"
            alt="Parade"
            className="h-16 w-16 rounded-2xl mx-auto mb-6 object-cover shadow-md"
          />
          <h2
            className="text-3xl sm:text-4xl text-foreground tracking-[-0.02em]"
            style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 900 }}
          >
            Join the parade.
          </h2>
          <p className="text-foreground/65 mt-3 text-base leading-[1.7]">
            Free to start. Bring your calendar and a friend or two.
          </p>

          <div className="mt-8 space-y-3">
            <Link to="/login?signup=true" className="block">
              <Button className="w-full rounded-full shadow-md" size="lg">
                Create your account
              </Button>
            </Link>
            <p className="text-sm text-foreground/55">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mt-10 text-xs text-foreground/45">
            <a href="/privacy" className="hover:text-foreground/70 transition-colors underline underline-offset-2">
              Privacy
            </a>
            <span aria-hidden>·</span>
            <a href="/terms" className="hover:text-foreground/70 transition-colors underline underline-offset-2">
              Terms
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
