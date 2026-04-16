import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActivitySuggestion {
  id: string;
  proposalId: string;
  suggestedBy: string;
  suggesterName?: string;
  suggesterAvatar?: string | null;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ActivityVote {
  id: string;
  suggestionId: string;
  userId: string;
  rank: number;
}

export function useTripActivities(proposalId: string | null) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [votes, setVotes] = useState<ActivityVote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!proposalId) {
      setSuggestions([]);
      setVotes([]);
      return;
    }
    setLoading(true);
    const { data: sData } = await supabase
      .from('trip_activity_suggestions' as any)
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });

    const rows = (sData as any[]) || [];
    const userIds = [...new Set(rows.map(r => r.suggested_by))];
    let profileMap = new Map<string, { name: string; avatar: string | null }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase.rpc('get_display_names_for_users', { p_user_ids: userIds });
      for (const p of (profs || [])) {
        profileMap.set(p.user_id, { name: p.display_name || 'Friend', avatar: p.avatar_url });
      }
    }

    const suggestionList: ActivitySuggestion[] = rows.map(r => ({
      id: r.id,
      proposalId: r.proposal_id,
      suggestedBy: r.suggested_by,
      suggesterName: profileMap.get(r.suggested_by)?.name,
      suggesterAvatar: profileMap.get(r.suggested_by)?.avatar,
      title: r.title,
      description: r.description,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));
    setSuggestions(suggestionList);

    const ids = suggestionList.map(s => s.id);
    if (ids.length > 0) {
      const { data: vData } = await supabase
        .from('trip_activity_votes' as any)
        .select('*')
        .in('suggestion_id', ids);
      setVotes(((vData as any[]) || []).map(v => ({
        id: v.id,
        suggestionId: v.suggestion_id,
        userId: v.user_id,
        rank: v.rank,
      })));
    } else {
      setVotes([]);
    }
    setLoading(false);
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  const addSuggestion = useCallback(async (title: string, description?: string) => {
    if (!user || !proposalId) return false;
    const trimmed = title.trim();
    if (!trimmed) return false;
    const { error } = await supabase.from('trip_activity_suggestions' as any).insert({
      proposal_id: proposalId,
      suggested_by: user.id,
      title: trimmed.slice(0, 200),
      description: description?.trim().slice(0, 1000) || null,
    });
    if (error) {
      console.error('addSuggestion error', error);
      return false;
    }
    await load();
    return true;
  }, [user, proposalId, load]);

  const deleteSuggestion = useCallback(async (id: string) => {
    const { error } = await supabase.from('trip_activity_suggestions' as any).delete().eq('id', id);
    if (error) return false;
    await load();
    return true;
  }, [load]);

  /** Submit a complete ranking: suggestionId -> rank (1 = top). Replaces all prior votes by this user. */
  const submitRanking = useCallback(async (rankings: Record<string, number>) => {
    if (!user || !proposalId) return false;
    const ids = suggestions.map(s => s.id);
    if (ids.length === 0) return false;
    // Delete existing
    await supabase
      .from('trip_activity_votes' as any)
      .delete()
      .in('suggestion_id', ids)
      .eq('user_id', user.id);

    const rows = Object.entries(rankings).map(([sid, rank]) => ({
      suggestion_id: sid,
      user_id: user.id,
      rank,
    }));
    if (rows.length === 0) {
      await load();
      return true;
    }
    const { error } = await supabase.from('trip_activity_votes' as any).insert(rows);
    if (error) {
      console.error('submitRanking error', error);
      return false;
    }
    await load();
    return true;
  }, [user, proposalId, suggestions, load]);

  /** Borda count: rank 1 of N → N points. */
  const scores = (() => {
    const map = new Map<string, number>();
    for (const s of suggestions) map.set(s.id, 0);
    // Group votes per user to determine N (per-user ballot length)
    const byUser = new Map<string, ActivityVote[]>();
    for (const v of votes) {
      if (!byUser.has(v.userId)) byUser.set(v.userId, []);
      byUser.get(v.userId)!.push(v);
    }
    for (const userVotes of byUser.values()) {
      const n = userVotes.length;
      for (const v of userVotes) {
        const pts = n - v.rank + 1;
        map.set(v.suggestionId, (map.get(v.suggestionId) || 0) + pts);
      }
    }
    return map;
  })();

  const myRanking = (() => {
    const m: Record<string, number> = {};
    for (const v of votes) {
      if (v.userId === user?.id) m[v.suggestionId] = v.rank;
    }
    return m;
  })();

  const voterCount = new Set(votes.map(v => v.userId)).size;

  return {
    suggestions,
    votes,
    scores,
    myRanking,
    voterCount,
    loading,
    addSuggestion,
    deleteSuggestion,
    submitRanking,
    reload: load,
  };
}
