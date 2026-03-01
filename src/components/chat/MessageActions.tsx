import { useState } from 'react';
import { Pencil, Trash2, MoreVertical, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  messageId: string;
  content: string;
  isMe: boolean;
  hasImage: boolean;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReply?: (messageId: string) => void;
}

export function MessageActions({ messageId, content, isMe, hasImage, onEdit, onDelete, onReply }: MessageActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveEdit = async () => {
    if (editText.trim() && editText.trim() !== content) {
      await onEdit(messageId, editText.trim());
    }
    setEditOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity",
              "h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted active:bg-muted"
            )}
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isMe ? "end" : "start"} className="w-32 z-[70]">
          {onReply && (
            <DropdownMenuItem onClick={() => onReply(messageId)}>
              <Reply className="h-3.5 w-3.5 mr-2 scale-x-[-1]" />
              Reply
            </DropdownMenuItem>
          )}
          {isMe && (
            <DropdownMenuItem onClick={() => { setEditText(content); setEditOpen(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {isMe && (
            <DropdownMenuItem
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="z-[70] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
          </DialogHeader>
          <Input
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) handleSaveEdit();
            }}
            className="!text-[16px] md:!text-sm"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editText.trim() || editText.trim() === content}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this message for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(messageId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
