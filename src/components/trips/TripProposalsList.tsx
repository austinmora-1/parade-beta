import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plane, Check, Calendar, MapPin, Users, ThumbsUp, Loader2, Home, Edit2, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProposalDate {
  id: string;
  start_date: string;
  end_date: string;
  votes: number;
}

interface Participant {
  id: string;
  user_id: string;
  status: string;
  preferred_date_id: string | null;
  display_name: string;
  avatar_url: string | null;
}

interface TripProposal {
  id: string;
  created_by: string;
  destination: string | null;
  status: string;
  created_at: string;
  creator_name: string;
  creator_avatar: string | null;
  dates: ProposalDate[];
  participants: Participant[];
  myParticipantId: string;
  myVotedDateId: string | null;
  proposal_type: string;
  host_user_id: string | null;
  host_name: string | null;
}

export function TripProposalsList() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<TripProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get proposals where the user is a participant
    const { data: myParticipations } = await supabase
      .from('trip_proposal_participants')
      .select('id, proposal_id, status, preferred_date_id, user_id')
      .eq('user_id', user.id);

    if (!myParticipations?.length) {
      setProposals([]);
      setLoading(false);
      return;
    }

    const proposalIds = myParticipations.map(p => p.proposal_id);

    // Fetch proposals, dates, and all participants in parallel
    const [
      { data: proposalsData },
      { data: datesData },
      { data: allParticipants },
    ] = await Promise.all([
      supabase.from('trip_proposals').select('*').in('id', proposalIds).eq('status', 'pending'),
      supabase.from('trip_proposal_dates').select('*').in('proposal_id', proposalIds).order('start_date'),
      supabase.from('trip_proposal_participants').select('*').in('proposal_id', proposalIds),
    ]);

    if (!proposalsData?.length) {
      setProposals([]);
      setLoading(false);
      return;
    }

    // Fetch creator + participant profiles
    const allUserIds = [
      ...new Set([
        ...proposalsData.map(p => p.created_by),
        ...(allParticipants || []).map(p => p.user_id),
      ]),
    ];
    const { data: profiles } = await supabase
      .rpc('get_display_names_for_users', { p_user_ids: allUserIds });
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, { name: p.display_name, avatar: p.avatar_url }])
    );

    const mapped: TripProposal[] = proposalsData.map(prop => {
      const myRow = myParticipations.find(p => p.proposal_id === prop.id)!;
      const creator = profileMap.get(prop.created_by);
      const propDates = (datesData || []).filter(d => d.proposal_id === prop.id);
      const propParticipants = (allParticipants || [])
        .filter(p => p.proposal_id === prop.id)
        .map(p => {
          const profile = profileMap.get(p.user_id);
          return {
            ...p,
            display_name: profile?.name || 'Unknown',
            avatar_url: profile?.avatar || null,
          };
        });

      return {
        id: prop.id,
        created_by: prop.created_by,
        destination: prop.destination,
        status: prop.status,
        created_at: prop.created_at,
        creator_name: creator?.name || 'Someone',
        creator_avatar: creator?.avatar || null,
        dates: propDates,
        participants: propParticipants,
        myParticipantId: myRow.id,
        myVotedDateId: myRow.preferred_date_id,
        proposal_type: (prop as any).proposal_type || 'trip',
        host_user_id: (prop as any).host_user_id || null,
        host_name: (prop as any).host_user_id ? (profileMap.get((prop as any).host_user_id)?.name || null) : null,
      };
    });

    setProposals(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleVote = async (proposalId: string, dateId: string, participantId: string) => {
    setVoting(`${proposalId}:${dateId}`);
    try {
      // Update participant's preferred_date_id
      const { error: updateErr } = await supabase
        .from('trip_proposal_participants')
        .update({ preferred_date_id: dateId, status: 'voted' })
        .eq('id', participantId);

      if (updateErr) throw updateErr;

      // Increment vote count on the date
      const proposal = proposals.find(p => p.id === proposalId);
      const oldVotedDateId = proposal?.myVotedDateId;

      // If switching vote, decrement old
      if (oldVotedDateId && oldVotedDateId !== dateId) {
        const oldDate = proposal?.dates.find(d => d.id === oldVotedDateId);
        if (oldDate) {
          await supabase
            .from('trip_proposal_dates')
            .update({ votes: Math.max(0, oldDate.votes - 1) })
            .eq('id', oldVotedDateId);
        }
      }

      // Increment new (only if not re-voting same)
      if (oldVotedDateId !== dateId) {
        const newDate = proposal?.dates.find(d => d.id === dateId);
        await supabase
          .from('trip_proposal_dates')
          .update({ votes: (newDate?.votes || 0) + 1 })
          .eq('id', dateId);
      }

      confetti({
        particleCount: 40,
        spread: 45,
        origin: { y: 0.7 },
        colors: ['#3D8C6C', '#F59E0B', '#3B82F6'],
        scalar: 0.8,
      });
      toast.success('Vote recorded! ✈️');
      await fetchProposals();
    } catch (err) {
      console.error('Vote failed:', err);
      toast.error('Failed to vote. Try again?');
    } finally {
      setVoting(null);
    }
  };

  const handleDelete = async (proposalId: string) => {
    try {
      // Delete dates, participants, then proposal
      await supabase.from('trip_proposal_dates').delete().eq('proposal_id', proposalId);
      await supabase.from('trip_proposal_participants').delete().eq('proposal_id', proposalId);
      await supabase.from('trip_proposals').delete().eq('id', proposalId);
      toast.success('Proposal deleted');
      await fetchProposals();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to delete proposal');
    }
  };

  if (loading) return null;
  if (proposals.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Plane className="h-3.5 w-3.5" />
        Trip Proposals
      </h2>

      {proposals.map(proposal => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          currentUserId={user!.id}
          voting={voting}
          onVote={handleVote}
          onDelete={handleDelete}
          onRefresh={fetchProposals}
        />
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  currentUserId,
  voting,
  onVote,
  onDelete,
  onRefresh,
}: {
  proposal: TripProposal;
  currentUserId: string;
  voting: string | null;
  onVote: (proposalId: string, dateId: string, participantId: string) => void;
  onDelete: (proposalId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const isCreator = proposal.created_by === currentUserId;
  const totalVoters = proposal.participants.length;
  const votedCount = proposal.participants.filter(p => p.status === 'voted').length;
  const isVisit = proposal.proposal_type === 'visit';
  const isHost = proposal.host_user_id === currentUserId;

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editDestination, setEditDestination] = useState(proposal.destination || '');
  const [editDates, setEditDates] = useState(
    proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date }))
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // Update destination
      await supabase
        .from('trip_proposals')
        .update({ destination: editDestination.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', proposal.id);

      // Update existing dates, add new ones, delete removed ones
      const existingIds = proposal.dates.map(d => d.id);
      const editIds = editDates.filter(d => d.id && existingIds.includes(d.id)).map(d => d.id);
      
      // Delete removed dates
      const removedIds = existingIds.filter(id => !editIds.includes(id));
      if (removedIds.length > 0) {
        // Clear preferred_date_id for participants who voted on removed dates
        for (const rid of removedIds) {
          await supabase
            .from('trip_proposal_participants')
            .update({ preferred_date_id: null, status: 'pending' })
            .eq('proposal_id', proposal.id)
            .eq('preferred_date_id', rid);
        }
        await supabase.from('trip_proposal_dates').delete().in('id', removedIds);
      }

      // Update/insert dates
      for (const d of editDates) {
        if (d.id && existingIds.includes(d.id)) {
          await supabase
            .from('trip_proposal_dates')
            .update({ start_date: d.start_date, end_date: d.end_date })
            .eq('id', d.id);
        } else {
          await supabase.from('trip_proposal_dates').insert({
            proposal_id: proposal.id,
            start_date: d.start_date,
            end_date: d.end_date,
          });
        }
      }

      toast.success('Proposal updated');
      setEditOpen(false);
      await onRefresh();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to update proposal');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    await onDelete(proposal.id);
    setDeleting(false);
    setDeleteOpen(false);
  };

  const addDateOption = () => {
    const last = editDates[editDates.length - 1];
    const startDate = last ? new Date(last.start_date + 'T00:00:00') : new Date();
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + 7);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + 2);
    setEditDates([...editDates, {
      id: '',
      start_date: format(newStart, 'yyyy-MM-dd'),
      end_date: format(newEnd, 'yyyy-MM-dd'),
    }]);
  };

  const removeDateOption = (index: number) => {
    if (editDates.length <= 1) return;
    setEditDates(editDates.filter((_, i) => i !== index));
  };

  // Build title
  let cardTitle: string;
  if (isVisit) {
    if (isHost) {
      cardTitle = `Hosting in ${proposal.destination || 'your city'}`;
    } else if (proposal.host_name) {
      cardTitle = `${proposal.host_name} is hosting in ${proposal.destination || 'their city'}`;
    } else {
      cardTitle = `Visit to ${proposal.destination || 'TBD'}`;
    }
  } else {
    cardTitle = proposal.destination ? `Trip to ${proposal.destination}` : 'Group Trip';
  }

  const CardIcon = isVisit ? Home : Plane;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary shrink-0">
            <CardIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {cardTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {isCreator ? 'You proposed' : `${proposal.creator_name} proposed`} · {votedCount}/{totalVoters} voted
            </p>
          </div>
          {isCreator && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                setEditDestination(proposal.destination || '');
                setEditDates(proposal.dates.map(d => ({ id: d.id, start_date: d.start_date, end_date: d.end_date })));
                setEditOpen(true);
              }}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {proposal.participants.slice(0, 5).map(p => (
              <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={p.avatar_url || getElephantAvatar(p.display_name)} />
                <AvatarFallback className="text-[7px]">{p.display_name.charAt(0)}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {proposal.participants.map(p => p.display_name.split(' ')[0]).join(', ')}
          </span>
        </div>

        {/* Date options with vote buttons */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vote for your preferred dates
          </p>
          {proposal.dates.map(d => {
            const isMyVote = proposal.myVotedDateId === d.id;
            const isVoting = voting === `${proposal.id}:${d.id}`;
            const startDate = new Date(d.start_date + 'T00:00:00');
            const endDate = new Date(d.end_date + 'T00:00:00');

            return (
              <button
                key={d.id}
                onClick={() => {
                  if (!isMyVote) onVote(proposal.id, d.id, proposal.myParticipantId);
                }}
                disabled={isVoting}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                  isMyVote
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium">
                  {format(startDate, 'EEE, MMM d')} – {format(endDate, 'MMM d')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {d.votes > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {d.votes} vote{d.votes !== 1 ? 's' : ''}
                    </span>
                  )}
                  {isVoting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : isMyVote ? (
                    <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  ) : (
                    <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Destination</label>
              <Input
                value={editDestination}
                onChange={e => setEditDestination(e.target.value)}
                placeholder="Where to?"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Date Options</label>
                <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={addDateOption}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {editDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={d.start_date}
                    onChange={e => {
                      const updated = [...editDates];
                      updated[i] = { ...updated[i], start_date: e.target.value };
                      setEditDates(updated);
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="date"
                    value={d.end_date}
                    onChange={e => {
                      const updated = [...editDates];
                      updated[i] = { ...updated[i], end_date: e.target.value };
                      setEditDates(updated);
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                  />
                  {editDates.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive" onClick={() => removeDateOption(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this trip proposal and all votes. This cannot be undone.
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
    </>
  );
}
