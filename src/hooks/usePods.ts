import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Pod {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
  memberUserIds: string[];
  conversationId: string | null;
}

export function usePods() {
  const { user } = useAuth();
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPods = useCallback(async () => {
    if (!user?.id) {
      setPods([]);
      setLoading(false);
      return;
    }

    const podsRes = await supabase
      .from('pods')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    const podIds = (podsRes.data || []).map((p: any) => p.id);
    
    const membersRes = podIds.length > 0
      ? await supabase
          .from('pod_members')
          .select('pod_id, friend_user_id')
          .in('pod_id', podIds)
      : { data: [] };

    const membersByPod = new Map<string, string[]>();
    for (const m of (membersRes.data || []) as any[]) {
      const arr = membersByPod.get(m.pod_id) || [];
      arr.push(m.friend_user_id);
      membersByPod.set(m.pod_id, arr);
    }

    const result: Pod[] = ((podsRes.data || []) as any[]).map(p => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji || '💜',
      sortOrder: p.sort_order,
      memberUserIds: membersByPod.get(p.id) || [],
      conversationId: p.conversation_id || null,
    }));

    setPods(result);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const createPod = async (name: string, emoji: string = '💜') => {
    if (!user?.id) return;
    const maxOrder = pods.reduce((max, p) => Math.max(max, p.sortOrder), -1);
    const { data, error } = await supabase
      .from('pods')
      .insert({ user_id: user.id, name, emoji, sort_order: maxOrder + 1 })
      .select()
      .single();
    if (error) throw error;
    setPods(prev => [...prev, { id: (data as any).id, name, emoji, sortOrder: maxOrder + 1, memberUserIds: [] }]);
    return (data as any).id as string;
  };

  const updatePod = async (podId: string, updates: { name?: string; emoji?: string }) => {
    const { error } = await supabase.from('pods').update(updates).eq('id', podId);
    if (error) throw error;
    setPods(prev => prev.map(p => p.id === podId ? { ...p, ...updates } : p));
  };

  const deletePod = async (podId: string) => {
    const { error } = await supabase.from('pods').delete().eq('id', podId);
    if (error) throw error;
    setPods(prev => prev.filter(p => p.id !== podId));
  };

  const addMember = async (podId: string, friendUserId: string) => {
    const { error } = await supabase.from('pod_members').insert({ pod_id: podId, friend_user_id: friendUserId });
    if (error) {
      if (error.message?.includes('duplicate')) return; // Already a member
      throw error;
    }
    setPods(prev => prev.map(p =>
      p.id === podId ? { ...p, memberUserIds: [...p.memberUserIds, friendUserId] } : p
    ));
  };

  const removeMember = async (podId: string, friendUserId: string) => {
    const { error } = await supabase
      .from('pod_members')
      .delete()
      .eq('pod_id', podId)
      .eq('friend_user_id', friendUserId);
    if (error) throw error;
    setPods(prev => prev.map(p =>
      p.id === podId ? { ...p, memberUserIds: p.memberUserIds.filter(id => id !== friendUserId) } : p
    ));
  };

  const isInAnyPod = (friendUserId: string) =>
    pods.some(p => p.memberUserIds.includes(friendUserId));

  const getPodsForFriend = (friendUserId: string) =>
    pods.filter(p => p.memberUserIds.includes(friendUserId));

  return {
    pods,
    loading,
    createPod,
    updatePod,
    deletePod,
    addMember,
    removeMember,
    isInAnyPod,
    getPodsForFriend,
    refetch: fetchPods,
  };
}
