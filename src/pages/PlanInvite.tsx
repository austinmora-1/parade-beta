import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Check, Loader2, Sparkles, Users, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { ElephantLoader } from '@/components/ui/ElephantLoader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { getTimezoneAbbreviation, getBrowserTimezone } from '@/lib/timezone';

interface PlanInviteData {
  invite_id: string;
  plan_id: string;
  plan_title: string;
  plan_activity: string;
  plan_date: string;
  plan_time_slot: string;
  plan_duration: number;
  plan_location: string | null;
  plan_notes: string | null;
  plan_start_time: string | null;
  plan_end_time: string | null;
  invited_by_name: string;
  invited_by_avatar: string | null;
  invite_status: string;
  invite_email: string | null;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

const VALUE_PROPS = [
  { icon: Calendar, text: 'See when friends are free' },
  { icon: Sparkles, text: 'Plan together in seconds' },
  { icon: Heart, text: 'No more flaky group chats' },
];

export default function PlanInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<PlanInviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchInvite = async () => {
      const { data, error } = await supabase.rpc('get_plan_invite_details', { p_token: token });
      if (error || !data || (data as any[]).length === 0) {
        setError('This invite link is invalid or has expired.');
        setLoading(false);
      } else {
        const inviteData = (data as any[])[0] as PlanInviteData;
        setInvite(inviteData);

        // If signed in, redirect to plan detail page
        if (!authLoading && user) {
          if (inviteData.invite_status === 'accepted') {
            navigate(`/plan/${inviteData.plan_id}`, { replace: true });
          } else if (inviteData.invite_status === 'linked') {
            navigate(`/plan/${inviteData.plan_id}`, { replace: true });
          } else {
            navigate(`/plan/${inviteData.plan_id}?invite_token=${token}`, { replace: true });
          }
          return;
        }
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token, user, authLoading, navigate]);

  const handleAccept = async () => {
    if (!token) return;

    if (!user) {
      navigate(`/login?redirect=/plan-invite/${token}`);
      return;
    }

    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_plan_invite', { p_token: token });
      if (error) throw error;
      toast.success('You\'ve joined the plan!');
      navigate(`/plan/${data}`);
    } catch (err: any) {
      if (err.message?.includes('Already a participant')) {
        toast.info('You\'re already part of this plan.');
        navigate(`/plan/${invite?.plan_id}`);
      } else {
        toast.error(err.message || 'Failed to accept invite');
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <ParadeWordmark className="mb-8" />
        <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md w-full shadow-soft">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="font-display text-xl font-bold mb-2">Invalid Invite</h2>
          <p className="text-muted-foreground mb-6">{error || 'This invite could not be found.'}</p>
          <Button onClick={() => navigate('/landing')}>Go to Parade</Button>
        </div>
      </div>
    );
  }

  const activityConfig = ACTIVITY_CONFIG[invite.plan_activity as keyof typeof ACTIVITY_CONFIG] || { label: 'Activity', icon: '✨', color: 'activity-misc', vibeType: 'social' as const };
  const timeSlotConfig = TIME_SLOT_LABELS[invite.plan_time_slot as keyof typeof TIME_SLOT_LABELS];
  const isAccepted = invite.invite_status === 'accepted';
  const inviterFirstName = invite.invited_by_name?.split(' ')[0] || invite.invited_by_name;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Top bar */}
      <header className="px-4 py-5 flex items-center justify-center">
        <ParadeWordmark />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-10">
        <div className="w-full max-w-md space-y-5">
          {/* Hero invite badge */}
          <div className="flex flex-col items-center text-center pt-2 pb-1">
            <div className="relative mb-3">
              <Avatar className="h-20 w-20 ring-4 ring-background shadow-soft">
                {invite.invited_by_avatar && <AvatarImage src={invite.invited_by_avatar} />}
                <AvatarFallback className="text-2xl font-display">
                  {invite.invited_by_name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-background shadow-soft"
                style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.95)` }}
              >
                <ActivityIcon config={activityConfig} size={18} />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              {inviterFirstName} invited you
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              to <span className="font-medium text-foreground">{invite.plan_title}</span>
            </p>
          </div>

          {/* Plan card */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium">{format(new Date(invite.plan_date), 'EEEE, MMMM d')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>
                {invite.plan_start_time || invite.plan_end_time ? (
                  <>
                    {invite.plan_start_time && formatTime12(invite.plan_start_time)}
                    {invite.plan_start_time && invite.plan_end_time && ' – '}
                    {invite.plan_end_time && formatTime12(invite.plan_end_time)}
                    {timeSlotConfig && <span className="text-muted-foreground"> · {timeSlotConfig.label}</span>}
                    <span className="text-muted-foreground/60 ml-1">{getTimezoneAbbreviation(getBrowserTimezone())}</span>
                  </>
                ) : timeSlotConfig ? (
                  <>{timeSlotConfig.label} ({timeSlotConfig.time}) <span className="text-muted-foreground/60">{getTimezoneAbbreviation(getBrowserTimezone())}</span></>
                ) : (
                  invite.plan_time_slot
                )}
              </span>
            </div>
            {invite.plan_location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span>{invite.plan_location}</span>
              </div>
            )}
            {invite.plan_notes && (
              <div className="bg-muted/40 rounded-lg p-3 mt-1">
                <p className="text-sm text-foreground/80 italic">"{invite.plan_notes}"</p>
              </div>
            )}
          </div>

          {/* Action */}
          {isAccepted ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium">Invite already accepted</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Button onClick={handleAccept} disabled={accepting} className="w-full" size="lg">
                {accepting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : user ? (
                  'Join Plan'
                ) : (
                  `Join ${inviterFirstName} on Parade`
                )}
              </Button>
              {!user && (
                <p className="text-xs text-center text-muted-foreground">
                  Free · Takes 30 seconds · No app download required
                </p>
              )}
            </div>
          )}

          {/* Value prop section — only for non-users */}
          {!user && !isAccepted && (
            <div className="rounded-2xl bg-card/60 border border-border/60 p-5 mt-2 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold text-sm">What is Parade?</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Parade is a calmer way to make plans with friends — share your free time, see who's around, and skip the endless "you free Saturday?" texts.
              </p>
              <ul className="space-y-2.5">
                {VALUE_PROPS.map((vp) => (
                  <li key={vp.text} className="flex items-center gap-3 text-sm">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <vp.icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-foreground/80">{vp.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Login fallback */}
          {!user && !isAccepted && (
            <p className="text-center text-xs text-muted-foreground">
              Already on Parade?{' '}
              <button
                onClick={() => navigate(`/login?redirect=/plan-invite/${token}`)}
                className="text-primary font-medium underline-offset-2 hover:underline"
              >
                Log in
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
