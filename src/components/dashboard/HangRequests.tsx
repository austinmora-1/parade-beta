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
  sender_id: string | null;
  requester_name: string;
  requester_email: string | null;
  message: string | null;
  selected_day: string;
  selected_slot: string;
  status: string;
  created_at: string;
}

const TIME_SLOT_SHORT: Record<string, string> = {
  early_morning: '6-9am',
  late_morning: '9am-12pm',
  early_afternoon: '12-3pm',
  late_afternoon: '3-6pm',
  evening: '6-9pm',
  late_night: '9pm+',
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

  const isOutgoing = (request: HangRequest) => request.sender_id === user?.id;

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
        className={`rounded-lg border p-2.5 space-y-1.5 ${
          isPending && !outgoing
            ? 'border-primary/20 bg-primary/5'
            : 'border-border bg-card'
        }`}
      >
        {/* Row 1: Name + date/time + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {outgoing ? (
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ArrowDownLeft className="h-3 w-3 shrink-0 text-primary" />
            )}
            <span className="font-medium text-xs text-foreground truncate">
              {outgoing ? request.requester_name : request.requester_name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(parseISO(request.selected_day), 'MMM d')} · {TIME_SLOT_SHORT[request.selected_slot] || request.selected_slot}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={statusConf.variant} className="text-[10px] px-1.5 py-0">
              {statusConf.label}
            </Badge>
          </div>
        </div>

        {/* Row 2: Message (if any) */}
        {request.message && (
          <p className="text-xs text-muted-foreground truncate pl-4.5">
            💬 {request.message}
          </p>
        )}

        {/* Row 3: Actions (compact) */}
        {!outgoing && isPending && (
          <div className="flex gap-1.5 pl-4.5">
            <Button
              size="sm"
              onClick={() => updateStatus(request.id, 'accepted')}
              disabled={updating === request.id}
              className="h-6 px-2.5 text-xs gap-1"
            >
              {updating === request.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus(request.id, 'declined')}
              disabled={updating === request.id}
              className="h-6 px-2.5 text-xs gap-1"
            >
              <X className="h-3 w-3" />
              Decline
            </Button>
          </div>
        )}
        {(outgoing || !isPending) && (
          <div className="pl-4.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteRequest(request.id)}
              disabled={updating === request.id}
              className="h-6 px-2 text-xs gap-1 text-muted-foreground"
            >
              {updating === request.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Remove
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <Inbox className="h-4 w-4" />
              Hang Requests
            </span>
            <ShareDialog
              trigger={
                <Button size="sm" className="h-6 px-2 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  New
                </Button>
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No hang requests yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4" />
            Hang Requests
            {incomingPending.length > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {incomingPending.length}
              </Badge>
            )}
          </span>
          <ShareDialog
            trigger={
              <Button size="sm" className="h-6 px-2 text-xs gap-1">
                <Plus className="h-3 w-3" />
                New
              </Button>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Incoming pending */}
        {incomingPending.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ArrowDownLeft className="h-2.5 w-2.5" /> Incoming
            </p>
            {incomingPending.map(r => renderRequestCard(r, false))}
          </div>
        )}

        {/* Outgoing pending */}
        {outgoingPending.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ArrowUpRight className="h-2.5 w-2.5" /> Sent
            </p>
            {outgoingPending.map(r => renderRequestCard(r, true))}
          </div>
        )}

        {/* Resolved */}
        {resolved.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Past
            </p>
            {resolved.slice(0, 5).map(r => renderRequestCard(r, isOutgoing(r)))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
