import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeHub } from '@/hooks/useRealtimeHub';
import { usePlannerStore } from '@/stores/plannerStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleWidget } from './CollapsibleWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Check, X, Mail, MessageSquare, Calendar, Clock, Loader2, Inbox, Plus, Send, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { NewHangRequestDialog } from './NewHangRequestDialog';

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
  'early-morning': '6-9am',
  'early_morning': '6-9am',
  'late-morning': '9am-12pm',
  'late_morning': '9am-12pm',
  'early-afternoon': '12-3pm',
  'early_afternoon': '12-3pm',
  'late-afternoon': '3-6pm',
  'late_afternoon': '3-6pm',
  'evening': '6-9pm',
  'late-night': '9pm+',
  'late_night': '9pm+',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  accepted: { label: 'Accepted', variant: 'default' },
  declined: { label: 'Declined', variant: 'destructive' },
};

const DISMISSED_KEY = 'hang_requests_dismissed';
const SEEN_DECLINED_KEY = 'hang_requests_seen_declined';

function getDismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'));
  } catch { return new Set(); }
}

function addDismissedId(id: string) {
  const ids = getDismissedIds();
  ids.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function getSeenDeclinedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_DECLINED_KEY) || '[]'));
  } catch { return new Set(); }
}

function markDeclinedAsSeen(ids: string[]) {
  if (ids.length === 0) return;
  const seen = getSeenDeclinedIds();
  ids.forEach(id => seen.add(id));
  localStorage.setItem(SEEN_DECLINED_KEY, JSON.stringify([...seen]));
}

export function HangRequests() {
  const { loadPlans } = usePlannerStore();
  const { user } = useAuth();
  const [requests, setRequests] = useState<HangRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);
  const [seenDeclinedIds, setSeenDeclinedIds] = useState<Set<string>>(getSeenDeclinedIds);
  const seenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  // Realtime subscription to keep data fresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('hang-requests-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hang_requests' },
        () => { fetchRequests(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  // Mark declined requests as "seen" after they've been visible for 2 seconds
  useEffect(() => {
    const unseenDeclined = requests.filter(
      r => r.status === 'declined' && !seenDeclinedIds.has(r.id) && !dismissedIds.has(r.id)
    );

    if (unseenDeclined.length > 0) {
      seenTimerRef.current = setTimeout(() => {
        const ids = unseenDeclined.map(r => r.id);
        markDeclinedAsSeen(ids);
        setSeenDeclinedIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
      }, 2000);
    }

    return () => {
      if (seenTimerRef.current) clearTimeout(seenTimerRef.current);
    };
  }, [requests, seenDeclinedIds, dismissedIds]);

  const updateStatus = async (id: string, status: 'accepted' | 'declined') => {
    setUpdating(id);
    const { error } = await supabase
      .from('hang_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update request');
    } else {
      toast.success(status === 'accepted' ? 'Request accepted! A plan has been created 🎉' : 'Request declined');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (status === 'accepted') {
        await loadPlans();
      }
    }
    setUpdating(null);
  };

  const dismissRequest = (id: string) => {
    addDismissedId(id);
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.success('Request removed from list');
  };

  // Filter logic:
  // - Never show dismissed requests
  // - Hide declined requests that have already been seen
  const visibleRequests = requests.filter(r => {
    if (dismissedIds.has(r.id)) return false;
    if (r.status === 'declined' && seenDeclinedIds.has(r.id)) return false;
    return true;
  });

  const incomingPending = visibleRequests.filter(r => !isOutgoing(r) && r.status === 'pending');
  const outgoingPending = visibleRequests.filter(r => isOutgoing(r) && r.status === 'pending');
  const resolved = visibleRequests.filter(r => r.status !== 'pending');

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
        className={`group rounded-lg border p-2.5 space-y-1.5 ${
          isPending && !outgoing
            ? 'border-primary/20 bg-primary/5'
            : 'border-border bg-card'
        }`}
      >
        {/* Row 1: Name + date/time + status + dismiss */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {outgoing ? (
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ArrowDownLeft className="h-3 w-3 shrink-0 text-primary" />
            )}
            <span className="font-medium text-xs text-foreground truncate">
              {request.requester_name}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(parseISO(request.selected_day), 'MMM d')} · {TIME_SLOT_SHORT[request.selected_slot] || request.selected_slot}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={statusConf.variant} className="text-[10px] px-1.5 py-0">
              {statusConf.label}
            </Badge>
            <button
              onClick={() => dismissRequest(request.id)}
              disabled={updating === request.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity h-4 w-4 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Message (if any) */}
        {request.message && (
          <p className="text-xs text-muted-foreground truncate pl-4.5">
            💬 {request.message}
          </p>
        )}

        {/* Row 3: Accept/Decline for incoming pending only */}
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
      </div>
    );
  };

  if (visibleRequests.length === 0) {
    return (
      <CollapsibleWidget
        title="Hang Requests"
        icon={<Inbox className="h-4 w-4 text-primary" />}
        headerRight={
          <div onClick={(e) => e.stopPropagation()}>
            <NewHangRequestDialog
              trigger={
                <Button size="sm" className="h-6 px-2 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  New
                </Button>
              }
            />
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No hang requests yet</p>
        </div>
      </CollapsibleWidget>
    );
  }

  return (
    <CollapsibleWidget
      title="Hang Requests"
      icon={<Inbox className="h-4 w-4 text-primary" />}
      badge={
        incomingPending.length > 0 ? (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            {incomingPending.length}
          </Badge>
        ) : undefined
      }
      headerRight={
        <div onClick={(e) => e.stopPropagation()}>
          <NewHangRequestDialog
            trigger={
              <Button size="sm" className="h-6 px-2 text-xs gap-1">
                <Plus className="h-3 w-3" />
                New
              </Button>
            }
          />
        </div>
      }
    >
      <ScrollArea className="max-h-[280px]">
        <div className="space-y-2.5">
          {incomingPending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ArrowDownLeft className="h-2.5 w-2.5" /> Incoming
              </p>
              {incomingPending.map(r => renderRequestCard(r, false))}
            </div>
          )}

          {outgoingPending.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ArrowUpRight className="h-2.5 w-2.5" /> Sent
              </p>
              {outgoingPending.map(r => renderRequestCard(r, true))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Past
              </p>
              {resolved.slice(0, 5).map(r => renderRequestCard(r, isOutgoing(r)))}
            </div>
          )}
        </div>
      </ScrollArea>
    </CollapsibleWidget>
  );
}
