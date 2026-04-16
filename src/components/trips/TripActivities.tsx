import { useMemo, useState } from 'react';
import { Sparkles, Plus, Trash2, Trophy, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTripActivities, ActivitySuggestion } from '@/hooks/useTripActivities';
import { useAuth } from '@/hooks/useAuth';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  proposalId: string;
  participantCount: number;
}

export function TripActivities({ proposalId, participantCount }: Props) {
  const { user } = useAuth();
  const {
    suggestions,
    scores,
    myRanking,
    voterCount,
    addSuggestion,
    deleteSuggestion,
    submitRanking,
    loading,
  } = useTripActivities(proposalId);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [draftRanking, setDraftRanking] = useState<string[]>([]);
  const [savingVotes, setSavingVotes] = useState(false);

  const sortedByScore: ActivitySuggestion[] = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      const sa = scores.get(a.id) || 0;
      const sb = scores.get(b.id) || 0;
      if (sb !== sa) return sb - sa;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [suggestions, scores]);

  const maxScore = Math.max(1, ...Array.from(scores.values()));
  const hasVoted = Object.keys(myRanking).length > 0;

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    const ok = await addSuggestion(title, description);
    setSubmitting(false);
    if (ok) {
      setTitle('');
      setDescription('');
      setAdding(false);
      toast.success('Activity added');
    } else {
      toast.error('Failed to add activity');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteSuggestion(id);
    if (ok) toast.success('Removed');
  };

  const openVote = () => {
    // Pre-seed draft from current ranking, falling back to score order
    const existing = sortedByScore
      .map(s => ({ id: s.id, rank: myRanking[s.id] }))
      .filter(x => x.rank !== undefined)
      .sort((a, b) => (a.rank! - b.rank!))
      .map(x => x.id);
    const remaining = sortedByScore.map(s => s.id).filter(id => !existing.includes(id));
    setDraftRanking([...existing, ...remaining]);
    setVoteOpen(true);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...draftRanking];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraftRanking(next);
  };

  const saveVotes = async () => {
    setSavingVotes(true);
    const rankings: Record<string, number> = {};
    draftRanking.forEach((id, i) => { rankings[id] = i + 1; });
    const ok = await submitRanking(rankings);
    setSavingVotes(false);
    if (ok) {
      setVoteOpen(false);
      toast.success('Your ranking is saved');
    } else {
      toast.error('Failed to save ranking');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">
            Activities to Vote On ({suggestions.length})
          </h2>
        </div>
        {suggestions.length >= 2 && (
          <Button size="sm" variant={hasVoted ? 'outline' : 'default'} className="h-8 gap-1.5" onClick={openVote}>
            <Trophy className="h-3.5 w-3.5" />
            {hasVoted ? 'Update vote' : 'Rank them'}
          </Button>
        )}
      </div>

      {voterCount > 0 && (
        <p className="text-[11px] text-muted-foreground -mt-1">
          {voterCount} of {participantCount} {voterCount === 1 ? 'person has' : 'people have'} voted
        </p>
      )}

      {/* Vote panel */}
      {voteOpen && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold">Drag-rank: top is your favorite</p>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setVoteOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {draftRanking.map((id, idx) => {
              const s = suggestions.find(x => x.id === id);
              if (!s) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-card border border-border p-2">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{s.title}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === draftRanking.length - 1} onClick={() => moveItem(idx, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button className="w-full gap-1.5" onClick={saveVotes} disabled={savingVotes}>
            <Check className="h-4 w-4" />
            {savingVotes ? 'Saving…' : 'Save my ranking'}
          </Button>
        </div>
      )}

      {/* Suggestions list */}
      {loading && suggestions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">No activities yet — add the first one!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sortedByScore.map((s, i) => {
            const score = scores.get(s.id) || 0;
            const myRank = myRanking[s.id];
            const isMine = s.suggestedBy === user?.id;
            const widthPct = (score / maxScore) * 100;
            return (
              <div key={s.id} className="relative rounded-lg border border-border bg-card p-2.5 overflow-hidden">
                {score > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10"
                    style={{ width: `${widthPct}%` }}
                  />
                )}
                <div className="relative flex items-start gap-2.5">
                  {i === 0 && score > 0 ? (
                    <Trophy className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium">{s.title}</span>
                      {myRank && (
                        <span className="rounded-full bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5">
                          Your #{myRank}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={s.suggesterAvatar || getElephantAvatar(s.suggesterName)} />
                        <AvatarFallback className="text-[8px]">{s.suggesterName?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-muted-foreground">
                        {isMine ? 'You suggested' : s.suggesterName || 'A friend'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] font-semibold text-primary">{score} pts</span>
                    </div>
                  </div>
                  {isMine && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new */}
      {adding ? (
        <div className="rounded-xl border-2 border-primary/30 bg-card p-3 space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Activity title (e.g. Sunset dinner at Mama's)"
            maxLength={200}
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details (optional)"
            maxLength={1000}
            rows={2}
          />
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setTitle(''); setDescription(''); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={submitting || !title.trim()}>
              {submitting ? 'Adding…' : 'Add activity'}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full gap-1.5 border-dashed" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Suggest an activity
        </Button>
      )}
    </div>
  );
}
