import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Sparkles, Check, X, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOpenInvites } from '@/hooks/useOpenInvites';
import { toast } from 'sonner';

export function IncomingOpenInvites() {
  const { incoming, loading, claim, decline } = useOpenInvites();

  const visible = useMemo(
    () => incoming.filter((i) => i.status === 'open').slice(0, 5),
    [incoming]
  );

  if (loading || visible.length === 0) return null;

  const handleClaim = async (id: string, title: string) => {
    const res = await claim(id);
    if (res) {
      toast.success(`You claimed "${title}"! Plan created.`);
    } else {
      toast.error('Could not claim — it may already be taken.');
    }
  };

  const handleDecline = async (id: string) => {
    await decline(id);
    toast('Dismissed');
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Open invites for you</h3>
        <Badge variant="secondary" className="ml-auto">
          {visible.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {visible.map((invite) => (
          <div
            key={invite.id}
            className="rounded-lg border bg-card/50 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {invite.title}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {format(parseISO(invite.date), 'EEE, MMM d')} ·{' '}
                    {invite.time_slot.replace(/-/g, ' ')}
                  </span>
                </div>
                {invite.location && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    📍 {invite.location}
                  </div>
                )}
                {invite.notes && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {invite.notes}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={() => handleClaim(invite.id, invite.title)}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                I'm in
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => handleDecline(invite.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
