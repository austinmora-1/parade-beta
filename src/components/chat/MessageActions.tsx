import { useState } from 'react';
import { Pencil, Trash2, MoreVertical, X, Check, Reply } from 'lucide-react';
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveEdit = async () => {
    if (editText.trim() && editText.trim() !== content) {
      await onEdit(messageId, editText);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          value={editText}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) handleSaveEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 text-xs flex-1 !text-[16px] md:!text-xs"
          autoFocus
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveEdit}>
          <Check className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity",
              "h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted"
            )}
          >
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isMe ? "end" : "start"} className="w-32">
          {onReply && (
            <DropdownMenuItem onClick={() => onReply(messageId)}>
              <Reply className="h-3.5 w-3.5 mr-2 scale-x-[-1]" />
              Reply
            </DropdownMenuItem>
          )}
          {isMe && !hasImage && (
            <DropdownMenuItem onClick={() => { setEditText(content); setEditing(true); }}>
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
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
