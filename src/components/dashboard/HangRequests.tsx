import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Check, X, Mail, MessageSquare, Calendar, Clock, Loader2, Inbox, Plus, Send, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { ShareDialog } from './ShareDialog';

interface HangRequest {
  id: string;
  user_id: string;
  requester_name: string;
  requester_email: string | null;
  message: string | null;
  selected_day: string;
  selected_slot: string;
  status: string;
  created_at: string;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  early_morning: 'Early Morning (6-9am)',
  late_morning: 'Late Morning (9am-12pm)',
  early_afternoon: 'Early Afternoon (12-3pm)',
  late_afternoon: 'Late Afternoon (3-6pm)',
  evening: 'Evening (6-9pm)',
  late_night: 'Late Night (9pm+)',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  accepted: { label: 'Accepted', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
};

export function HangRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<HangRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    const { data: hangRequests, error } = await supabase
      .from('hang_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching hang requests:', error);
      setLoading(false);
      return;
    }

    const { data: emails } = await supabase
      .from('hang_request_emails')
      .select('hang_request_id, requester_email');

    const emailMap = new Map(emails?.map(e => [e.hang_request_id, e.requester_email]) || []);
    const requestsWithEmails: HangRequest[] = (hangRequests || []).map(r => ({
      ...r,
      requester_email: emailMap.get(r.id) || null
    }));

    setRequests(requestsWithEmails);
    setLoading(false);
  };

  const isOutgoing = (request: HangRequest) => request.user_id === user?.id;

  const updateStatus = async (id: string, status: 'accepted' | 'declined') => {
    setUpdating(id);
    const { error } = await supabase
      .from('hang_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(status === 'accepted' ? 'Request accepted!' : 'Request declined');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
    setUpdating(null);
  };

  const deleteRequest = async (id: string) => {
    setUpdating(id);
    const { error } = await supabase
      .from('hang_requests')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete request');
    } else {
      toast.success('Request removed');
      setRequests(prev => prev.filter(r => r.id !== id));
    }
    setUpdating(null);
  };

  const incomingPending = requests.filter(r => !isOutgoing(r) && r.status === 'pending');
  const outgoingPending = requests.filter(r => isOutgoing(r) && r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderRequestCard = (request: HangRequest, outgoing: boolean) => {
    const isPending = request.status === 'pending';
    const statusConf = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;

    return (
      <div
        key={request.id}
        className={`rounded-xl border p-4 space-y-3 ${
          isPending && !outgoing
            ? 'border-primary/20 bg-primary/5'
            : 'border-border bg-card'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {outgoing ? (
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              <p className="font-semibold text-foreground truncate text-sm">
                {outgoing ? `To: ${request.requester_name}` : request.requester_name}
              </p>
            </div>
            {!outgoing && request.requester_email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate ml-5">
                <Mail className="h-3 w-3 shrink-0" />
                {request.requester_email}
              </p>
            )}
          </div>
          <Badge variant={statusConf.variant} className="shrink-0 text-xs">
            {statusConf.label}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(parseISO(request.selected_day), 'EEE, MMM d')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {TIME_SLOT_LABELS[request.selected_slot] || request.selected_slot}
          </span>
        </div>

        {request.message && (
          <div className="flex items-start gap-2 rounded-lg bg-background p-3">
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-sm text-foreground">{request.message}</p>
          </div>
        )}

        {/* Actions: only incoming pending gets accept/decline, all get delete */}
        <div className="flex gap-2 pt-1">
          {!outgoing && isPending && (
            <>
              <Button
                size="sm"
                onClick={() => updateStatus(request.id, 'accepted')}
                disabled={updating === request.id}
                className="flex-1 gap-1"
              >
                {updating === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus(request.id, 'declined')}
                disabled={updating === request.id}
                className="flex-1 gap-1"
              >
                <X className="h-4 w-4" />
                Decline
              </Button>
            </>
          )}
          {(outgoing || !isPending) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteRequest(request.id)}
              disabled={updating === request.id}
              className="gap-1 text-muted-foreground"
            >
              {updating === request.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Remove
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg">
              <Inbox className="h-5 w-5" />
              Hang Requests
            </span>
            <ShareDialog
              trigger={
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No hang requests yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Share your profile to start receiving requests
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5" />
            Hang Requests
            {incomingPending.length > 0 && (
              <Badge variant="default" className="ml-2">
                {incomingPending.length} new
              </Badge>
            )}
          </span>
          <ShareDialog
            trigger={
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                New
              </Button>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Incoming pending */}
        {incomingPending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3" /> Incoming
            </p>
            {incomingPending.map(r => renderRequestCard(r, false))}
          </div>
        )}

        {/* Outgoing pending */}
        {outgoingPending.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Sent
            </p>
            {outgoingPending.map(r => renderRequestCard(r, true))}
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">
              Past
            </p>
            {resolved.slice(0, 5).map(r => renderRequestCard(r, isOutgoing(r)))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
