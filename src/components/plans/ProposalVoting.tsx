import { useState, useEffect, useMemo } from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Check, Crown, Loader2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanProposalOption, PlanProposalVote, TIME_SLOT_LABELS, TimeSlot } from '@/types/planner';
import { usePlanProposals } from '@/hooks/usePlanProposals';
import { usePlannerStore } from '@/stores/plannerStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getElephantAvatar } from '@/lib/elephantAvatars';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12}${ampm}` : `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export interface VoterProfile {
  userId: string;
  name: string;
  avatar?: string;
}

interface ProposalVotingProps {
  planId: string;
  isOwner: boolean;
  participantCount: number;
  compact?: boolean;
  /** Profiles of all participants + organizer for voter indicators */
  voterProfiles?: VoterProfile[];
}

export function ProposalVoting({ planId, isOwner, participantCount, compact = false, voterProfiles = [] }: ProposalVotingProps) {
  const userId = usePlannerStore((s) => s.userId);
  const { loadProposalData, submitVotes, finalizePlan, computeScores, isLoading } = usePlanProposals();
  const [options, setOptions] = useState<PlanProposalOption[]>([]);
  const [votes, setVotes] = useState<PlanProposalVote[]>([]);
  const [myRankings, setMyRankings] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    loadProposalData(planId).then(({ options: opts, votes: v }) => {
      setOptions(opts);
      setVotes(v);
      // Initialize rankings from existing votes
      if (userId) {
        const existing: Record<string, number> = {};
        for (const vote of v) {
          if (vote.userId === userId) {
            existing[vote.optionId] = vote.rank;
          }
        }
        setMyRankings(existing);
      }
      setLoaded(true);
    });
  }, [planId, userId]);

  const scores = useMemo(() => computeScores(options, votes), [options, votes, computeScores]);
  
  const voterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const v of votes) ids.add(v.userId);
    return ids;
  }, [votes]);

  const hasVoted = userId ? voterIds.has(userId) : false;
  const totalVoters = voterIds.size;
  // +1 for the organizer
  const totalExpected = participantCount + 1;

  const topOptionId = useMemo(() => {
    let maxScore = -1;
    let topId = '';
    for (const [id, score] of scores) {
      if (score > maxScore) { maxScore = score; topId = id; }
    }
    return topId;
  }, [scores]);

  const handleRankToggle = (optionId: string) => {
    setMyRankings(prev => {
      const existing = { ...prev };
      if (optionId in existing) {
        // Remove this option and re-rank
        const removedRank = existing[optionId];
        delete existing[optionId];
        for (const [id, rank] of Object.entries(existing)) {
          if (rank > removedRank) existing[id] = rank - 1;
        }
      } else {
        // Add at the end
        const nextRank = Object.keys(existing).length + 1;
        existing[optionId] = nextRank;
      }
      return existing;
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(myRankings).length === 0) {
      toast.error('Please rank at least one option');
      return;
    }
    const success = await submitVotes(options, myRankings);
    if (success) {
      toast.success('Votes submitted!');
      // Reload
      const { options: opts, votes: v } = await loadProposalData(planId);
      setOptions(opts);
      setVotes(v);
    } else {
      toast.error('Failed to submit votes');
    }
  };

  const handleFinalize = async (option: PlanProposalOption) => {
    setIsFinalizing(true);
    const success = await finalizePlan(planId, option);
    if (success) {
      toast.success('Plan confirmed! 🎉');
    } else {
      toast.error('Failed to finalize');
    }
    setIsFinalizing(false);
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-xs text-muted-foreground">Loading options...</span>
      </div>
    );
  }

  if (options.length === 0) return null;

  const sortedOptions = [...options].sort((a, b) => a.sortOrder - b.sortOrder);

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {totalVoters}/{totalExpected} voted
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {sortedOptions.map(opt => {
            const score = scores.get(opt.id) || 0;
            const isTop = opt.id === topOptionId && totalVoters > 0;
            const myRank = myRankings[opt.id];
            return (
              <button
                key={opt.id}
                onClick={(e) => { e.stopPropagation(); handleRankToggle(opt.id); }}
                data-stop-card-click
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-all",
                  myRank
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40",
                  isTop && "ring-1 ring-amber-400/50"
                )}
              >
                {isTop && <Crown className="h-2.5 w-2.5 text-amber-500" />}
                {myRank && <span className="font-bold text-primary">#{myRank}</span>}
                <span>{format(opt.date, 'MMM d')}</span>
                <span className="text-muted-foreground/60">
                  {TIME_SLOT_LABELS[opt.timeSlot]?.label || opt.timeSlot}
                </span>
                {score > 0 && (
                  <span className="rounded-full bg-primary/15 px-1 text-[8px] font-bold text-primary">{score}</span>
                )}
              </button>
            );
          })}
        </div>
        {!hasVoted && Object.keys(myRankings).length > 0 && (
          <Button
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            disabled={isLoading}
            data-stop-card-click
          >
            {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : 'Submit Votes'}
          </Button>
        )}
      </div>
    );
  }

  // Full view for PlanDetail
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Vote for Times</h3>
        <span className="text-xs text-muted-foreground">{totalVoters}/{totalExpected} voted</span>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasVoted ? 'You\'ve voted! Tap to update your rankings.' : 'Tap options in order of preference (1st = most preferred)'}
      </p>

      <div className="space-y-2">
        {sortedOptions.map(opt => {
          const score = scores.get(opt.id) || 0;
          const isTop = opt.id === topOptionId && totalVoters > 0;
          const myRank = myRankings[opt.id];
          const maxScore = Math.max(...Array.from(scores.values()), 1);
          const barWidth = score > 0 ? (score / maxScore) * 100 : 0;
          const slotLabel = TIME_SLOT_LABELS[opt.timeSlot];

          return (
            <motion.button
              key={opt.id}
              onClick={() => handleRankToggle(opt.id)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "relative w-full rounded-xl border p-3 text-left transition-all overflow-hidden",
                myRank
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
                isTop && "ring-2 ring-amber-400/30"
              )}
            >
              {/* Score bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative flex items-center gap-3">
                {/* Rank badge */}
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold shrink-0",
                  myRank
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground"
                )}>
                  {myRank || '—'}
                </div>

                {/* Date & time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {isToday(opt.date) ? 'Today' : isTomorrow(opt.date) ? 'Tomorrow' : format(opt.date, 'EEE, MMM d')}
                    </span>
                    {isTop && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {opt.startTime ? formatTime12(opt.startTime) : slotLabel?.label}
                    {slotLabel && !opt.startTime && <span className="ml-1 opacity-60">({slotLabel.time})</span>}
                  </span>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-primary">{score}</div>
                  <div className="text-[10px] text-muted-foreground">pts</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Submit / Update votes */}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || Object.keys(myRankings).length === 0}
        className="w-full"
        size="sm"
      >
        {isLoading ? (
          <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Submitting...</>
        ) : hasVoted ? 'Update Rankings' : 'Submit Rankings'}
      </Button>

      {/* Finalize (organizer only) */}
      {isOwner && totalVoters > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            🏆 Top pick: {(() => {
              const topOpt = options.find(o => o.id === topOptionId);
              if (!topOpt) return '—';
              return `${format(topOpt.date, 'EEE, MMM d')} — ${TIME_SLOT_LABELS[topOpt.timeSlot]?.label}`;
            })()}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                const topOpt = options.find(o => o.id === topOptionId);
                if (topOpt) handleFinalize(topOpt);
              }}
              disabled={isFinalizing}
            >
              {isFinalizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Confirm Top Pick
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
