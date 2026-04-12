import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Merge, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TripConflict {
  trip_a_id: string;
  trip_a_location: string;
  trip_a_start: string;
  trip_a_end: string;
  trip_b_id: string;
  trip_b_location: string;
  trip_b_start: string;
  trip_b_end: string;
}

interface TripConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: TripConflict[];
  onResolved: () => void;
}

export function TripConflictDialog({ open, onOpenChange, conflicts, onResolved }: TripConflictDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const conflict = conflicts[currentIndex];
  if (!conflict) return null;

  const goToNext = () => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
      onOpenChange(false);
      onResolved();
    }
  };

  const handleKeepA = async () => {
    setSaving(true);
    try {
      // Delete trip B, expand trip A to cover both date ranges
      const newStart = conflict.trip_a_start < conflict.trip_b_start ? conflict.trip_a_start : conflict.trip_b_start;
      const newEnd = conflict.trip_a_end > conflict.trip_b_end ? conflict.trip_a_end : conflict.trip_b_end;

      await supabase.from('trips').update({
        start_date: newStart,
        end_date: newEnd,
      }).eq('id', conflict.trip_a_id);

      await supabase.from('trips').delete().eq('id', conflict.trip_b_id);
      toast.success(`Kept trip to ${conflict.trip_a_location}`);
    } catch {
      toast.error('Failed to resolve conflict');
    } finally {
      setSaving(false);
      goToNext();
    }
  };

  const handleKeepB = async () => {
    setSaving(true);
    try {
      const newStart = conflict.trip_a_start < conflict.trip_b_start ? conflict.trip_a_start : conflict.trip_b_start;
      const newEnd = conflict.trip_a_end > conflict.trip_b_end ? conflict.trip_a_end : conflict.trip_b_end;

      await supabase.from('trips').update({
        start_date: newStart,
        end_date: newEnd,
      }).eq('id', conflict.trip_b_id);

      await supabase.from('trips').delete().eq('id', conflict.trip_a_id);
      toast.success(`Kept trip to ${conflict.trip_b_location}`);
    } catch {
      toast.error('Failed to resolve conflict');
    } finally {
      setSaving(false);
      goToNext();
    }
  };

  const handleKeepBoth = () => {
    // User says these are intentionally separate trips
    goToNext();
  };

  const fmtDate = (d: string) => format(new Date(d + 'T00:00:00'), 'MMM d');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Overlapping Trips
          </DialogTitle>
          <DialogDescription>
            These two trips overlap. How would you like to resolve this?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {conflicts.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Conflict {currentIndex + 1} of {conflicts.length}
            </p>
          )}

          <div className="space-y-2">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-sm font-medium">{conflict.trip_a_location}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(conflict.trip_a_start)} – {fmtDate(conflict.trip_a_end)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-sm font-medium">{conflict.trip_b_location}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(conflict.trip_b_start)} – {fmtDate(conflict.trip_b_end)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={handleKeepA}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              <Merge className="h-4 w-4" />
              Keep "{conflict.trip_a_location}"
            </Button>
            <Button
              size="sm"
              onClick={handleKeepB}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              <Merge className="h-4 w-4" />
              Keep "{conflict.trip_b_location}"
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleKeepBoth}
              disabled={saving}
              className="w-full justify-start gap-2"
            >
              Keep both as separate trips
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
