import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, MessageCircle, Users, Check } from 'lucide-react';
import { usePlannerStore } from '@/stores/plannerStore';
import { cn } from '@/lib/utils';

interface NewChatDialogProps {
  onCreateDM: (friendUserId: string) => Promise<string | null>;
  onCreateGroup: (title: string, memberIds: string[]) => Promise<string | null>;
}

export function NewChatDialog({ onCreateDM, onCreateGroup }: NewChatDialogProps) {
  const { friends } = usePlannerStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'pick' | 'group'>('pick');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);

  // Only friends with a friendUserId (registered on the app) and connected
  const registeredFriends = friends.filter(f => f.friendUserId && f.status === 'connected');

  const handleDM = async (friendUserId: string) => {
    setCreating(true);
    const conversationId = await onCreateDM(friendUserId);
    if (conversationId) {
      setOpen(false);
    }
    setCreating(false);
  };

  const toggleSelect = (friendUserId: string) => {
    setSelectedIds(prev =>
      prev.includes(friendUserId) ? prev.filter(x => x !== friendUserId) : [...prev, friendUserId]
    );
  };

  const handleCreateGroup = async () => {
    if (selectedIds.length < 2 || !groupTitle.trim()) return;
    setCreating(true);
    const conversationId = await onCreateGroup(groupTitle.trim(), selectedIds);
    if (conversationId) {
      setOpen(false);
      setMode('pick');
      setSelectedIds([]);
      setGroupTitle('');
    }
    setCreating(false);
  };

  const reset = () => {
    setMode('pick');
    setSelectedIds([]);
    setGroupTitle('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'pick' ? 'Start a chat' : 'Create group chat'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'pick' && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setMode('group')}
            >
              <Users className="h-4 w-4" />
              Create a group chat
            </Button>

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Direct message</p>
              {registeredFriends.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 py-4 text-center">
                  Add friends to start chatting!
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {registeredFriends.map(friend => (
                    <button
                      key={friend.friendUserId}
                      onClick={() => handleDM(friend.friendUserId!)}
                      disabled={creating}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {friend.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{friend.name}</span>
                      <MessageCircle className="ml-auto h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'group' && (
          <div className="space-y-3">
            <Input
              placeholder="Group name"
              value={groupTitle}
              onChange={e => setGroupTitle(e.target.value)}
            />
            <p className="text-xs font-medium text-muted-foreground">Select members (2+)</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {registeredFriends.map(friend => {
                const selected = selectedIds.includes(friend.friendUserId!);
                return (
                  <button
                    key={friend.friendUserId}
                    onClick={() => toggleSelect(friend.friendUserId!)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selected ? "bg-primary/10" : "hover:bg-accent"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {friend.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{friend.name}</span>
                    {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMode('pick')}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={selectedIds.length < 2 || !groupTitle.trim() || creating}
                onClick={handleCreateGroup}
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
