import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronDown, CheckCircle2, Loader2 } from 'lucide-react';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { ConfettiBackground } from '@/components/landing/ConfettiBackground';
import paradeElephantLogo from '@/assets/parade-elephant-dark.png';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

function BetaSignupForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('loops-subscribe', {
        body: { email: email.trim(), firstName: firstName.trim() || undefined },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Something went wrong');

      setIsSubmitted(true);
      toast.success(data.alreadySubscribed ? "You're already on the list!" : "You're in! We'll be in touch.");
    } catch (err) {
      console.error('Signup error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Bungee', system-ui" }}>
          You're on the list!
        </h3>
        <p className="text-muted-foreground mt-2 text-sm">
          We'll let you know when Parade is ready for you.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="text"
        placeholder="Full name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
        className="bg-background/80 border-border/50"
        maxLength={100}
      />
      <Input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-background/80 border-border/50"
        maxLength={255}
      />
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Joining...</> : 'Join the Waitlist'}
      </Button>
    </form>
  );
}

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
              Endless group chats, 'are you around?' texts, and memes sent, but still find plans always seem to fall through? Parade brings order to the chaos: a simple, seamless platform that connects your existing calendars to show you who's free, who's in town, and what your plans are, making it easy to turn a "TBD" into a "hell yeah".
            </p>
            <div className="mt-5">
              <Button onClick={scrollToSignup} className="text-sm sm:text-base px-6 py-5">
                Join the Waitlist
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

      {/* Beta Signup Section */}
      <section ref={signupRef} className="relative py-20 px-6 bg-card/90">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src="/icon-192.png" alt="Parade" className="h-20 w-20 rounded-2xl mx-auto mb-4 object-cover" />
            <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Bungee', system-ui" }}>Join the Parade</h2>
            <p className="text-muted-foreground mt-2">Sign up for early access to the beta.</p>
          </div>
          <BetaSignupForm />
          <p className="text-center text-xs text-muted-foreground mt-6">
            We'll never spam you. Unsubscribe anytime.
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
