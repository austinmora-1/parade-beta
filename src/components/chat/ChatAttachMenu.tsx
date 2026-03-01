import { useState } from 'react';
import { Plus, ImagePlus, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChatImageUpload } from './ChatImageUpload';
import { GifPicker } from './GifPicker';
import { EmojiPicker } from './EmojiPicker';

interface ChatAttachMenuProps {
  onImageUploaded: (url: string) => void;
  onGifSelected: (url: string) => void;
  onEmojiSelect: (emoji: string) => void;
  onEllyMention: () => void;
}

export function ChatAttachMenu({ onImageUploaded, onGifSelected, onEmojiSelect, onEllyMention }: ChatAttachMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
          title="Attach"
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-2 z-[70]">
        <div className="flex items-center gap-1">
          <ChatImageUpload onImageUploaded={(url) => { onImageUploaded(url); setOpen(false); }} />
          <GifPicker onGifSelect={(url) => { onGifSelected(url); setOpen(false); }}>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Send a GIF"
            >
              <span className="text-xs font-bold">GIF</span>
            </button>
          </GifPicker>
          <EmojiPicker onEmojiSelect={(emoji) => { onEmojiSelect(emoji); }} />
          <button
            onClick={() => { onEllyMention(); setOpen(false); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors"
            title="Mention Elly"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
