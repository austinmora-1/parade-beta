import { useState } from 'react';
import { Friend } from '@/types/planner';
import { Pod } from '@/hooks/usePods';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  onOpenPod?: (pod: Pod) => void;
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
  onOpenPod,
}: PodSectionProps) {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [deletingPod, setDeletingPod] = useState<Pod | null>(null);
  const [addMemberPod, setAddMemberPod] = useState<Pod | null>(null);
  const [newPodName, setNewPodName] = useState('');
  const [newPodEmoji, setNewPodEmoji] = useState('💜');
  const [memberSearch, setMemberSearch] = useState('');

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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold">
          <Heart className="h-4 w-4 text-primary fill-primary" />
          Pods
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-[11px] px-2"
          onClick={() => {
            setNewPodName('');
            setNewPodEmoji('💜');
            setCreateDialogOpen(true);
          }}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {pods.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {pods.map(pod => {
            const podFriends = getPodFriends(pod);
            const displayAvatars = podFriends.slice(0, 4);
            const extraCount = podFriends.length - displayAvatars.length;

            return (
              <button
                key={pod.id}
                onClick={() => onOpenPod?.(pod)}
                className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-soft hover:bg-accent/50 transition-colors shrink-0 min-w-0"
              >
                {/* Emoji + name */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm leading-none">{pod.emoji}</span>
                  <span className="text-xs font-medium truncate max-w-[80px]">{pod.name}</span>
                </div>

                {/* Stacked avatars */}
                {podFriends.length > 0 ? (
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {displayAvatars.map(f => (
                      <Avatar key={f.id} className="h-5 w-5 ring-1 ring-card">
                        <AvatarImage src={f.avatar || undefined} />
                        <AvatarFallback className={cn("text-[7px] font-semibold", getAvatarColor(f.name))}>
                          {getInitials(f.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {extraCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground ring-1 ring-card">
                        +{extraCount}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Empty</span>
                )}

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[120px]">
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberSearch('');
                        setAddMemberPod(pod);
                      }}
                    >
                      <UserPlus className="mr-1.5 h-3 w-3" />
                      Add Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewPodName(pod.name);
                        setNewPodEmoji(pod.emoji);
                        setEditingPod(pod);
                      }}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPod(pod);
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3 w-3" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => {
            setNewPodName('');
            setNewPodEmoji('💜');
            setCreateDialogOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 w-full hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-primary font-medium">Create a pod to group your close friends</span>
        </button>
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
