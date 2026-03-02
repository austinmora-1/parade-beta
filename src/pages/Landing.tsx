import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, LayoutDashboard, CalendarClock, CalendarPlus, Users, MessageCircle } from 'lucide-react';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import landingHero from '@/assets/landing-hero.jpeg';
import landingElephants from '@/assets/parade-logo.png';
import paradeElephantLogo from '@/assets/parade-elephant-dark.png';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    title: 'Your Social Home Base',
    description: 'See everything at a glance — upcoming plans, your vibe for the day, incoming vibes from friends, and what\'s happening this week. Parade keeps your social life organized without the effort.',
    icon: LayoutDashboard,
  },
  {
    title: 'Share Your Availability',
    description: 'Let friends know when you\'re free without the back-and-forth texting. Set your weekly schedule, toggle between home and away, and sync your calendar so availability updates automatically.',
    icon: CalendarClock,
  },
  {
    title: 'Make Plans in Seconds',
    description: 'Create plans with a tap — pick an activity, invite friends, and find a time that works for everyone. Calendar sync means you\'ll never double-book, and friends get notified instantly.',
    icon: CalendarPlus,
  },
  {
    title: 'Your Friends, Your Pod',
    description: 'Group your closest friends into pods for easy scheduling. See who\'s available, send hang requests, and coordinate group plans without the chaos of group chats.',
    icon: Users,
  },
  {
    title: 'Chat & Send Vibes',
    description: 'Message friends directly about plans, send vibes to share your mood, and let Elly — your AI planning assistant — help suggest the perfect hangout. All your social coordination in one place.',
    icon: MessageCircle,
  },
];

type AuthView = 'auth' | 'forgot-password' | 'reset-password';

function AuthSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>('auth');
  const { signIn, signUp, resetPassword, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (searchParams.get('reset') === 'true' && session) {
      setView('reset-password');
    }
  }, [searchParams, session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error(error.message);
    else { toast.success('Welcome back!'); navigate('/'); }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    if (error) toast.error(error.message);
    else { toast.success("Account created! Let's get you set up."); navigate('/onboarding'); }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    if (error) toast.error(error.message);
    else { toast.success('Check your email for a password reset link!'); setView('auth'); }
    setIsLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) toast.error(error.message);
    else { toast.success('Password updated successfully!'); navigate('/'); }
    setIsLoading(false);
  };

  return (
    <Card className="border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
      {view === 'auth' && (
        <>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Get Started</CardTitle>
            <CardDescription>Sign in or create a new account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signup" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="login">Login</TabsTrigger>
              </TabsList>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display Name</Label>
                    <Input id="signup-name" type="text" placeholder="Your name" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <button type="button" onClick={() => setView('forgot-password')} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                    Forgot your password?
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </>
      )}

      {view === 'forgot-password' && (
        <>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <button type="button" onClick={() => setView('auth')} className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </button>
            </form>
          </CardContent>
        </>
      )}

      {view === 'reset-password' && (
        <>
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Set New Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export default function Landing() {
  const authRef = useRef<HTMLDivElement>(null);

  const scrollToAuth = () => {
    authRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${landingHero})` }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-3xl mx-auto w-full flex flex-col items-center" style={{ isolation: 'isolate' }}>
          <img src={paradeElephantLogo} alt="Parade" className="h-32 w-32 sm:h-40 sm:w-40 mx-auto mb-6" style={{ mixBlendMode: 'screen' }} />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ParadeWordmark size="xl" className="text-white drop-shadow-lg" />
            <p className="mt-1 font-medium text-sm sm:text-base tracking-[0.2em] uppercase text-primary drop-shadow-md" style={{ fontFamily: "'Bungee', system-ui" }}>
              Designed for Fun
            </p>
            <p className="mt-3 text-white/80 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              Plan your social life in one place. Connect your calendars, see when friends are free,
              share your vibe for the day, and make plans faster — all in one fun, AI-powered social calendar.
            </p>
            <div className="mt-5 flex flex-row gap-3 justify-center w-full items-center">
              <Button onClick={scrollToAuth} className="text-sm sm:text-base px-5 py-4 sm:px-6 sm:py-5">
                Get Started
              </Button>
              <Button variant="outline" onClick={scrollToAuth} className="text-sm sm:text-base px-5 py-4 sm:px-6 sm:py-5 border-white/30 text-white hover:bg-white/10 bg-white/5">
                Sign In
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

      {/* Feature Sections — alternating layout */}
      {FEATURES.map((feature, i) => {
        const isReversed = i % 2 === 1;
        return (
          <section
            key={feature.title}
            className={`py-20 px-6 ${i % 2 === 0 ? 'bg-card' : 'bg-background'}`}
          >
            <div
              className={`max-w-5xl mx-auto flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-16`}
            >
              {/* Text */}
              <motion.div
                className="flex-1 text-center md:text-left"
                initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {feature.title}
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>

              {/* Icon */}
              <motion.div
                className="flex-shrink-0"
                initial={{ opacity: 0, x: isReversed ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="w-[200px] h-[200px] md:w-[240px] md:h-[240px] rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl">
                  <feature.icon className="w-20 h-20 md:w-24 md:h-24 text-primary" strokeWidth={1.2} />
                </div>
              </motion.div>
            </div>
          </section>
        );
      })}

      {/* CTA + Auth Section */}
      <section ref={authRef} className="py-20 px-6 bg-card">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src="/icon-192.png" alt="Parade" className="h-20 w-20 rounded-2xl mx-auto mb-4 object-cover" />
            <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Bungee', system-ui" }}>Join the Parade</h2>
            <p className="text-muted-foreground mt-2">Create your account and start planning.</p>
          </div>
          <AuthSection />
          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </div>
  );
}
