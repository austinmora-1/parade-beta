import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Users, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ACTIVITY_CONFIG, TIME_SLOT_LABELS } from '@/types/planner';
import { ActivityIcon } from '@/components/ui/ActivityIcon';
import { Button } from '@/components/ui/button';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

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

        // If signed in, redirect to plan detail page with invite token
        if (!authLoading && user) {
          if (inviteData.invite_status === 'accepted') {
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
  }, [token, user, authLoading]);

  const handleAccept = async () => {
    if (!token) return;
    
    if (!user) {
      // Redirect to landing with return URL
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <ParadeWordmark className="mb-8" />

      <div className="rounded-2xl border border-border bg-card p-6 max-w-md w-full shadow-soft space-y-6">
        {/* Inviter info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {invite.invited_by_avatar && <AvatarImage src={invite.invited_by_avatar} />}
            <AvatarFallback>{invite.invited_by_name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{invite.invited_by_name}</span> invited you to a plan
            </p>
          </div>
        </div>

        {/* Plan details */}
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl shrink-0"
              style={{ backgroundColor: `hsl(var(--${activityConfig.color}) / 0.15)` }}
            >
              <ActivityIcon config={activityConfig} size={28} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">{invite.plan_title}</h1>
              <p className="text-sm text-muted-foreground">{activityConfig.label}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{format(new Date(invite.plan_date), 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {invite.plan_start_time || invite.plan_end_time ? (
                  <>
                    {invite.plan_start_time && formatTime12(invite.plan_start_time)}
                    {invite.plan_start_time && invite.plan_end_time && ' – '}
                    {invite.plan_end_time && formatTime12(invite.plan_end_time)}
                    {timeSlotConfig && <span className="text-muted-foreground"> · {timeSlotConfig.label}</span>}
                  </>
                ) : timeSlotConfig ? (
                  <>{timeSlotConfig.label} ({timeSlotConfig.time})</>
                ) : (
                  invite.plan_time_slot
                )}
              </span>
            </div>
            {invite.plan_location && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{invite.plan_location}</span>
              </div>
            )}
          </div>

          {invite.plan_notes && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{invite.plan_notes}</p>
            </div>
          )}
        </div>

        {/* Action */}
        {isAccepted ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-primary/10 text-primary">
            <Check className="h-5 w-5" />
            <span className="font-medium">Invite already accepted</span>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleAccept} disabled={accepting} className="w-full" size="lg">
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : user ? (
                'Join Plan'
              ) : (
                'Sign up to join'
              )}
            </Button>
            {!user && (
              <p className="text-xs text-center text-muted-foreground">
                You'll need to create an account or log in to join this plan
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
