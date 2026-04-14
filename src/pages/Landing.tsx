import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { ConfettiBackground } from '@/components/landing/ConfettiBackground';
import paradeElephantLogo from '@/assets/parade-elephant-dark.png';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Landing() {
  const signupRef = useRef<HTMLDivElement>(null);

  const scrollToSignup = () => {
    signupRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <ConfettiBackground count={100} />
      </div>
      {/* Hero Section */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center" style={{ backgroundColor: '#1A2B22' }}>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #0F1A14 0%, #24382D 100%)' }}
        />
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto w-full flex flex-col items-center" style={{ isolation: 'isolate' }}>
          <img src={paradeElephantLogo} alt="Parade" className="h-32 w-32 sm:h-40 sm:w-40 mx-auto mb-6" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ParadeWordmark size="xl" className="text-primary drop-shadow-lg" />
            <p className="mt-1 font-medium text-sm sm:text-base tracking-[0.2em] uppercase text-primary drop-shadow-md" style={{ fontFamily: "'Bungee', system-ui" }}>
              Designed for Fun
            </p>
            <p className="mt-3 text-white/80 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              Stop letting plans die in the group chat. Parade syncs your calendars so you can see who's free, who's nearby, and what's on deck — no more 'wya' spirals, no more 'lmk' dead ends. Just real plans with real people, actually happening.
            </p>
            <div className="mt-5">
              <Button onClick={scrollToSignup} className="text-sm sm:text-base px-6 py-5">
                Get Started
              </Button>
            </div>
          </motion.div>
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <ChevronDown className="mx-auto h-7 w-7 text-white/50 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* Signup CTA Section */}
      <section ref={signupRef} className="relative py-20 px-6 bg-card/90">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src="/icon-192.png" alt="Parade" className="h-20 w-20 rounded-2xl mx-auto mb-4 object-cover" />
            <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Bungee', system-ui" }}>Join the Parade</h2>
            <p className="text-muted-foreground mt-2">Create your free account and start making plans.</p>
          </div>
          <Link to="/login?signup=true">
            <Button className="w-full" size="lg">Create Account</Button>
          </Link>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">Privacy Policy</a>
            <span>·</span>
            <a href="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">Terms & Conditions</a>
          </div>
        </div>
      </section>
    </div>
  );
}
