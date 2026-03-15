import { useState } from 'react';
import { CheckCircle2, HelpCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePlannerStore } from '@/stores/plannerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PlanRsvpButtonsProps {
  planId: string;
  userId: string;
  currentStatus?: string; // 'accepted' | 'maybe' | 'declined' | 'invited'
  compact?: boolean; // smaller buttons for inline card usage
}

export function PlanRsvpButtons({ planId, userId, currentStatus, compact = false }: PlanRsvpButtonsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { loadPlans } = usePlannerStore();

  const handleRsvp = async (newStatus: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('plan_participants')
        .update({ status: newStatus, responded_at: new Date().toISOString() })
        .eq('plan_id', planId)
        .eq('friend_id', userId);
      if (error) throw error;
      toast.success(
        newStatus === 'accepted' ? "You're going!" 
        : newStatus === 'maybe' ? 'Marked as maybe' 
        : 'Declined'
      );
      await loadPlans();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update RSVP');
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1" data-stop-card-click onClick={e => e.stopPropagation()}>
        {isUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <button
          onClick={(e) => handleRsvp('accepted', e)}
          disabled={isUpdating}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
            currentStatus === 'accepted'
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          Going
        </button>
        <button
          onClick={(e) => handleRsvp('maybe', e)}
          disabled={isUpdating}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
            currentStatus === 'maybe'
              ? "bg-amber-500 text-white"
              : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
          )}
        >
          Maybe
        </button>
        <button
          onClick={(e) => handleRsvp('declined', e)}
          disabled={isUpdating}
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
            currentStatus === 'declined'
              ? "bg-destructive text-destructive-foreground"
              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
          )}
        >
          Can't
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={currentStatus === 'accepted' ? 'default' : 'outline'}
        size="sm"
        className="gap-1.5"
        disabled={isUpdating}
        onClick={(e) => handleRsvp('accepted', e)}
      >
        <CheckCircle2 className="h-4 w-4" /> Going
      </Button>
      <Button
        variant={currentStatus === 'maybe' ? 'default' : 'outline'}
        size="sm"
        className={`gap-1.5 ${currentStatus === 'maybe' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
        disabled={isUpdating}
        onClick={(e) => handleRsvp('maybe', e)}
      >
        <HelpCircle className="h-4 w-4" /> Maybe
      </Button>
      <Button
        variant={currentStatus === 'declined' ? 'default' : 'outline'}
        size="sm"
        className={`gap-1.5 ${currentStatus === 'declined' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
        disabled={isUpdating}
        onClick={(e) => handleRsvp('declined', e)}
      >
        <XCircle className="h-4 w-4" /> Can't Go
      </Button>
    </div>
  );
}
