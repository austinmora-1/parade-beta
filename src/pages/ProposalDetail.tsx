import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ArrowLeftRight, Trash2, Loader2, Plane, Home as HomeIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ElephantLoader } from '@/components/ui/ElephantLoader';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCityForDisplay } from '@/lib/formatCity';

interface ProposalRow {
  id: string;
  created_by: string;
  destination: string | null;
  proposal_type: string;
  host_user_id: string | null;
  status: string;
}

interface DateRow {
  id: string;
  start_date: string;
  end_date: string;
}

interface ParticipantRow {
  user_id: string;
}

const TRIPS_UPDATED_EVENT = 'trips:updated';

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [dates, setDates] = useState<DateRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: prop }, { data: ds }, { data: ps }] = await Promise.all([
      supabase.from('trip_proposals').select('*').eq('id', id).maybeSingle(),
      supabase.from('trip_proposal_dates').select('*').eq('proposal_id', id).order('start_date'),
      supabase.from('trip_proposal_participants').select('user_id').eq('proposal_id', id),
    ]);
    setProposal(prop as any);
    setDates((ds as any) || []);
    setParticipants((ps as any) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ElephantLoader />
      </div>
    );
  }

  if (!proposal || !user) {
    return (
      <div className="p-4 space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">Proposal not found.</p>
      </div>
    );
  }

  const isCreator = proposal.created_by === user.id;
  const isVisit = proposal.proposal_type === 'visit';
  const Icon = isVisit ? HomeIcon : Plane;
  const destinationLabel = proposal.destination
    ? (formatCityForDisplay(proposal.destination) || proposal.destination)
    : 'TBD';

  const handleConvertType = async () => {
    if (!isCreator) return;
    setConverting(true);
    try {
      const newType = isVisit ? 'trip' : 'visit';
      const updates: any = { proposal_type: newType, updated_at: new Date().toISOString() };
      if (newType === 'visit') {
        const otherId = participants.find(p => p.user_id !== user.id)?.user_id || null;
        updates.host_user_id = otherId;
      } else {
        updates.host_user_id = null;
      }
      await supabase.from('trip_proposals').update(updates).eq('id', proposal.id);
      toast.success(newType === 'visit' ? 'Converted to visit 🏠' : 'Converted to trip ✈️');
      window.dispatchEvent(new Event(TRIPS_UPDATED_EVENT));
      await load();
    } catch (err) {
      console.error('Convert failed:', err);
      toast.error('Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!isCreator) return;
    setDeleting(true);
    try {
      await supabase.from('trip_proposal_dates').delete().eq('proposal_id', proposal.id);
      await supabase.from('trip_proposal_participants').delete().eq('proposal_id', proposal.id);
      await supabase.from('trip_proposals').delete().eq('id', proposal.id);
      toast.success('Proposal deleted');
      window.dispatchEvent(new Event(TRIPS_UPDATED_EVENT));
      navigate('/trips');
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete proposal');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const earliest = dates[0]?.start_date;
  const latest = [...dates].sort((a, b) => b.end_date.localeCompare(a.end_date))[0]?.end_date;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Trips
      </Button>

      <div className="rounded-xl border border-border bg-card p-4 shadow-soft space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/15 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold truncate">
              {isVisit ? `Visit to ${destinationLabel}` : `Trip to ${destinationLabel}`}
            </h1>
            {earliest && latest && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(earliest + 'T00:00:00'), 'MMM d')} – {format(new Date(latest + 'T00:00:00'), 'MMM d')}
                {dates.length > 1 ? ` · ${dates.length} options` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {participants.length} participant{participants.length === 1 ? '' : 's'}
        </div>
      </div>

      {isCreator && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Manage proposal
          </h2>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleConvertType}
              disabled={converting}
            >
              {converting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4" />
              )}
              {isVisit ? 'Convert to trip' : 'Convert to visit'}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete proposal
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this proposal and all votes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
