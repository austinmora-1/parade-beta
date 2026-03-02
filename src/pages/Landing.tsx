import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Users, MessageCircle, Clock, Sparkles, ChevronDown } from 'lucide-react';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import landingHero from '@/assets/landing-hero.jpeg';
import landingElephants from '@/assets/landing-elephants.png';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: Calendar,
    title: 'Shared Availability',
    description: 'See when your friends are free at a glance. Share your weekly schedule and find overlapping time slots instantly.',
  },
  {
    icon: Users,
    title: 'Friend Pods',
    description: 'Group your closest friends into pods. Schedule hangs with multiple people by finding times that work for everyone.',
  },
  {
    icon: MessageCircle,
    title: 'Vibes & Chat',
    description: 'Send vibes to let friends know your mood. Chat directly about plans without leaving the app.',
  },
  {
    icon: Clock,
    title: 'Calendar Sync',
    description: 'Connect Google Calendar or iCal. Your availability updates automatically so you never double-book.',
  },
  {
    icon: Sparkles,
    title: 'AI Planning Assistant',
    description: 'Elly, your AI assistant, helps suggest plans, find the best times, and keep your social life on track.',
  },
];

type AuthView = 'auth' | 'forgot-password' | 'reset-password';

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>('auth');
  const { signIn, signUp, resetPassword, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authRef = useRef<HTMLDivElement>(null);

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

  const scrollToAuth = () => {
    authRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${landingHero})` }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <ParadeWordmark size="xl" className="text-white drop-shadow-lg" />
            <div className="mt-4 inline-block rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-6 py-2">
              <p className="text-white/90 font-medium text-lg">Social Planning, Designed for Fun</p>
            </div>
            <p className="mt-6 text-white/80 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              Plan your social life in one place. Connect your calendars, see when friends are free,
              share your vibe for the day, and make plans faster — all in one fun, AI-powered social calendar.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={scrollToAuth} className="text-lg px-8 py-6">
                Get Started
              </Button>
              <Button size="lg" variant="outline" onClick={scrollToAuth} className="text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10 bg-white/5">
                Sign In
              </Button>
            </div>
          </motion.div>
          <motion.div
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <ChevronDown className="mx-auto h-8 w-8 text-white/50 animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-card">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything you need to hang out more
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Stop missing out. Parade makes it effortless to coordinate with friends and turn free time into quality time.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-2xl border border-border bg-background hover:shadow-lg transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              See Parade in Action
            </h2>
            <p className="text-muted-foreground text-lg mb-10">
              Watch how easy it is to coordinate plans with your friends.
            </p>
          </motion.div>
          <motion.div
            className="rounded-2xl overflow-hidden shadow-2xl border border-border aspect-[9/16] max-w-sm mx-auto"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <video
              className="w-full h-full object-cover"
              controls
              playsInline
              preload="metadata"
              poster={landingElephants}
            >
              <source src="/demo-video.mov" type="video/quicktime" />
              <source src="/demo-video.mov" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </motion.div>
        </div>
      </section>

      {/* CTA + Auth Section */}
      <section ref={authRef} className="py-20 px-6 bg-card">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <img src={landingElephants} alt="" className="h-20 w-20 rounded-2xl mx-auto mb-4 object-cover" />
            <h2 className="text-3xl font-bold text-foreground">Join the Parade</h2>
            <p className="text-muted-foreground mt-2">Create your account and start planning.</p>
          </div>

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

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </div>
  );
}
