import { useState } from 'react';
import { Friend } from '@/types/planner';
import { Pod } from '@/hooks/usePods';
import { FriendAvatarGrid } from './FriendAvatarGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Plus, MoreHorizontal, Pencil, Trash2, UserPlus, X, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PodSectionProps {
  pods: Pod[];
  friends: Friend[];
  lastHungOut?: Record<string, Date>;
  onRemoveFriend: (id: string) => void;
  onCreatePod: (name: string, emoji: string) => Promise<string | undefined>;
  onUpdatePod: (podId: string, updates: { name?: string; emoji?: string }) => Promise<void>;
  onDeletePod: (podId: string) => Promise<void>;
  onAddMember: (podId: string, friendUserId: string) => Promise<void>;
  onRemoveMember: (podId: string, friendUserId: string) => Promise<void>;
}

const EMOJI_OPTIONS = ['💜', '🔥', '⭐', '🎯', '🏠', '🎉', '💪', '🌿', '🎵', '☕', '🍻', '🧘'];

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColors = [
  'bg-primary/20 text-primary',
  'bg-activity-drinks/20 text-activity-drinks',
  'bg-activity-sports/20 text-activity-sports',
  'bg-activity-music/20 text-activity-music',
  'bg-activity-nature/20 text-activity-nature',
];
const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

export function PodSection({
  pods,
  friends,
  lastHungOut,
  onRemoveFriend,
  onCreatePod,
  onUpdatePod,
  onDeletePod,
  onAddMember,
  onRemoveMember,
}: PodSectionProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [deletingPod, setDeletingPod] = useState<Pod | null>(null);
  const [addMemberPod, setAddMemberPod] = useState<Pod | null>(null);
  const [newPodName, setNewPodName] = useState('');
  const [newPodEmoji, setNewPodEmoji] = useState('💜');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedPodId, setSelectedPodId] = useState<string>(pods[0]?.id ?? '');

  // Keep selectedPodId in sync when pods change
  const selectedPod = pods.find(p => p.id === selectedPodId) ?? pods[0] ?? null;
  if (selectedPod && selectedPodId !== selectedPod.id) {
    setSelectedPodId(selectedPod.id);
  }

  const connectedFriends = friends.filter(f => f.status === 'connected' && f.friendUserId);

  const handleCreatePod = async () => {
    if (!newPodName.trim()) return;
    try {
      await onCreatePod(newPodName.trim(), newPodEmoji);
      toast({ title: `${newPodEmoji} ${newPodName} created!` });
      setNewPodName('');
      setNewPodEmoji('💜');
      setCreateDialogOpen(false);
    } catch {
      toast({ title: 'Failed to create pod', variant: 'destructive' });
    }
  };

  const handleUpdatePod = async () => {
    if (!editingPod || !newPodName.trim()) return;
    try {
      await onUpdatePod(editingPod.id, { name: newPodName.trim(), emoji: newPodEmoji });
      toast({ title: 'Pod updated!' });
      setEditingPod(null);
      setNewPodName('');
      setNewPodEmoji('💜');
    } catch {
      toast({ title: 'Failed to update pod', variant: 'destructive' });
    }
  };

  const handleDeletePod = async () => {
    if (!deletingPod) return;
    try {
      await onDeletePod(deletingPod.id);
      toast({ title: `${deletingPod.name} deleted` });
      setDeletingPod(null);
    } catch {
      toast({ title: 'Failed to delete pod', variant: 'destructive' });
    }
  };

  const getPodFriends = (pod: Pod): Friend[] =>
    connectedFriends.filter(f => f.friendUserId && pod.memberUserIds.includes(f.friendUserId));

  const getAvailableFriendsForPod = (pod: Pod) => {
    const q = memberSearch.trim().toLowerCase();
    return connectedFriends.filter(f =>
      f.friendUserId &&
      !pod.memberUserIds.includes(f.friendUserId) &&
      (q.length === 0 || f.name.toLowerCase().includes(q))
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with dropdown */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold">
          <Heart className="h-4 w-4 text-primary fill-primary" />
          Pods
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs px-2"
          onClick={() => {
            setNewPodName('');
            setNewPodEmoji('💜');
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-3 w-3" />
          New Pod
        </Button>
      </div>

      {pods.length > 0 ? (
        <>
          {/* Pod selector dropdown */}
          <Select value={selectedPodId} onValueChange={setSelectedPodId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Select a pod" />
            </SelectTrigger>
            <SelectContent>
              {pods.map(pod => (
                <SelectItem key={pod.id} value={pod.id} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{pod.emoji}</span>
                    <span>{pod.name}</span>
                    <span className="text-muted-foreground">({getPodFriends(pod).length})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected pod content */}
          {selectedPod && (() => {
            const podFriends = getPodFriends(selectedPod);
            return (
              <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                    <span>{selectedPod.emoji}</span>
                    {selectedPod.name} ({podFriends.length})
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setMemberSearch('');
                        setAddMemberPod(selectedPod);
                      }}
                    >
                      <UserPlus className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[120px]">
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => {
                            setNewPodName(selectedPod.name);
                            setNewPodEmoji(selectedPod.emoji);
                            setEditingPod(selectedPod);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3 w-3" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive text-xs"
                          onClick={() => setDeletingPod(selectedPod)}
                        >
                          <Trash2 className="mr-1.5 h-3 w-3" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {podFriends.length > 0 ? (
                  <FriendAvatarGrid
                    friends={podFriends}
                    onRemove={onRemoveFriend}
                    lastHungOut={lastHungOut}
                    onTogglePod={(friendId) => {
                      const friend = friends.find(f => f.id === friendId);
                      if (friend?.friendUserId) {
                        onRemoveMember(selectedPod.id, friend.friendUserId);
                        toast({ title: `Removed ${friend.name} from ${selectedPod.name}` });
                      }
                    }}
                  />
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-3">
                    No members yet — tap <UserPlus className="inline h-3 w-3" /> to add friends
                  </p>
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <Heart className="h-6 w-6 text-primary mx-auto mb-1.5" />
          <h3 className="text-xs font-semibold">Create your first Pod</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
            Group your close friends for quick access
          </p>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => {
              setNewPodName('');
              setNewPodEmoji('💜');
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3" />
            New Pod
          </Button>
        </div>
      )}

      {/* Create / Edit Pod Dialog */}
      <Dialog
        open={createDialogOpen || !!editingPod}
        onOpenChange={(open) => {
          if (!open) { setCreateDialogOpen(false); setEditingPod(null); }
        }}
      >
        <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingPod ? 'Edit Pod' : 'New Pod'}
            </DialogTitle>
            <DialogDescription>
              {editingPod ? 'Update your pod name and emoji.' : 'Create a group for your close friends.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium">Name</label>
              <Input
                placeholder="e.g. College Crew"
                value={newPodName}
                onChange={(e) => setNewPodName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (editingPod ? handleUpdatePod() : handleCreatePod())}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Emoji</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_OPTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setNewPodEmoji(emoji)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-all",
                      newPodEmoji === emoji
                        ? "bg-primary/15 ring-2 ring-primary"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={editingPod ? handleUpdatePod : handleCreatePod}
              disabled={!newPodName.trim()}
            >
              {editingPod ? 'Save Changes' : 'Create Pod'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addMemberPod} onOpenChange={(open) => !open && setAddMemberPod(null)}>
        <DialogContent className="sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              Add to {addMemberPod?.emoji} {addMemberPod?.name}
            </DialogTitle>
            <DialogDescription>
              Select friends to add to this pod.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search friends..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {addMemberPod && getAvailableFriendsForPod(addMemberPod).map(friend => (
                <button
                  key={friend.id}
                  onClick={async () => {
                    if (friend.friendUserId && addMemberPod) {
                      await onAddMember(addMemberPod.id, friend.friendUserId);
                      toast({ title: `Added ${friend.name} to ${addMemberPod.name}` });
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/60 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={friend.avatar} />
                    <AvatarFallback className={cn("text-[9px]", getAvatarColor(friend.name))}>
                      {getInitials(friend.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate flex-1 text-left">{friend.name}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
              {addMemberPod && getAvailableFriendsForPod(addMemberPod).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {memberSearch ? 'No matching friends' : 'All friends are already in this pod'}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPod} onOpenChange={(open) => !open && setDeletingPod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingPod?.emoji} {deletingPod?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the pod. Your friends won't be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePod}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
