import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😅', '😬', '🤔', '🫡', '😴'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫶', '👋', '🤙', '✨'] },
  { label: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💕', '💖', '💗', '💝', '💘'] },
  { label: 'Fun', emojis: ['🔥', '⭐', '🎉', '🎊', '💯', '🏆', '🎵', '🍕', '🍻', '☕', '🌈', '🚀'] },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" side="top" align="start">
        <div className="space-y-2 max-h-[240px] overflow-y-auto">
          {EMOJI_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1">{group.label}</p>
              <div className="grid grid-cols-6 gap-0.5">
                {group.emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onEmojiSelect(emoji);
                      setOpen(false);
                    }}
                    className="h-8 w-full flex items-center justify-center rounded-lg text-lg hover:bg-muted transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
