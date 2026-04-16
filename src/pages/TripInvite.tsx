import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, MapPin, Users, Check, Loader2, Plane, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ParadeWordmark } from '@/components/ui/ParadeWordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDisplayName } from '@/lib/formatName';
import { formatCityForDisplay } from '@/lib/formatCity';

interface TripDateOption {
  id: string;
  start_date: string;
  end_date: string;
  votes: number;
}

interface TripInviteData {
  invite_status: string;
  proposal_id: string;
  trip_id: string | null;
  destination: string | null;
  proposal_type: 'trip' | 'visit';
  proposal_status: string;
  host: {
    user_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  dates: TripDateOption[];
  participant_count: number;
  error?: string;
}

export default function TripInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invite, setInvite] = useState<TripInviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchInvite = async () => {
      const { data, error } = await supabase.rpc('get_trip_invite_details', { p_token: token });
      if (error || !data) {
        setError('This invite link is invalid or has expired.');
        setLoading(false);
        return;
      }
      const inviteData = data as unknown as TripInviteData;
      if (inviteData.error) {
        setError('This invite link is invalid or has expired.');
        setLoading(false);
        return;
      }
      setInvite(inviteData);
      setLoading(false);
    };
    fetchInvite();
  }, [token]);

  // Auto-accept after sign-in (if logged in and invite valid)
  useEffect(() => {
    if (!user || !invite || authLoading) return;
    // If the invite is already accepted by this user, just redirect
    if (invite.invite_status === 'accepted' && invite.trip_id) {
      navigate(`/trip/${invite.trip_id}`, { replace: true });
    }
  }, [user, invite, authLoading, navigate]);

  const handleAccept = async () => {
    if (!token) return;
    if (!user) {
      navigate(`/login?redirect=/trip-invite/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
      if (error) throw error;
      const result = data as { proposal_id: string; trip_id: string | null };
      toast.success("You've joined the trip!");
      if (result.trip_id) {
        navigate(`/trip/${result.trip_id}`);
      } else {
        navigate('/trips');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invite');
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

  const isVisit = invite.proposal_type === 'visit';
  const Icon = isVisit ? Home : Plane;
  const hostName = formatDisplayName({
    first_name: invite.host?.first_name,
    last_name: invite.host?.last_name,
    display_name: invite.host?.display_name,
  } as any);
  const destDisplay = invite.destination
    ? (formatCityForDisplay(invite.destination) || invite.destination)
    : (isVisit ? 'a visit' : 'a trip');
  const headlineLabel = isVisit ? 'Visit to' : 'Trip to';
  const isAccepted = invite.invite_status === 'accepted';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <ParadeWordmark className="mb-8" />

      <div className="rounded-2xl border border-border bg-card p-6 max-w-md w-full shadow-soft space-y-6">
        {/* Inviter info */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {invite.host?.avatar_url && <AvatarImage src={invite.host.avatar_url} />}
            <AvatarFallback>{hostName?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{hostName}</span> invited you to {isVisit ? 'a visit' : 'a trip'}
            </p>
          </div>
        </div>

        {/* Trip details */}
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">
                {headlineLabel} {destDisplay}
              </h1>
              <p className="text-sm text-muted-foreground">
                {invite.dates.length > 1 ? `${invite.dates.length} date options` : '1 date option'}
              </p>
            </div>
          </div>

          {/* Date options */}
          <div className="space-y-1.5">
            {invite.dates.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {format(new Date(d.start_date + 'T00:00:00'), 'EEE, MMM d')}
                  {d.start_date !== d.end_date && (
                    <> – {format(new Date(d.end_date + 'T00:00:00'), 'MMM d')}</>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Users className="h-4 w-4 shrink-0" />
            <span>
              {invite.participant_count} {invite.participant_count === 1 ? 'person' : 'people'} invited
            </span>
          </div>

          {invite.destination && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{destDisplay}</span>
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
                'Join & Vote'
              ) : (
                'Sign up to join'
              )}
            </Button>
            {!user && (
              <p className="text-xs text-center text-muted-foreground">
                You'll need an account to RSVP and rank dates. Browsing is always free.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
