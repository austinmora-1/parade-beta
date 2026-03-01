import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Smile, Search } from 'lucide-react';

const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀', '😂', '🥹', '😍', '🤩', '😎', '🥳', '😅', '😬', '🤔', '🫡', '😴'] },
  { label: 'Gestures', emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🫶', '👋', '🤙', '✨'] },
  { label: 'Hearts', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💕', '💖', '💗', '💝', '💘'] },
  { label: 'Fun', emojis: ['🔥', '⭐', '🎉', '🎊', '💯', '🏆', '🎵', '🍕', '🍻', '☕', '🌈', '🚀'] },
  { label: 'Animals', emojis: ['🐶', '🐱', '🐻', '🦊', '🐸', '🐵', '🦋', '🐝', '🐙', '🦄', '🐧', '🐼'] },
  { label: 'Food', emojis: ['🍔', '🌮', '🍣', '🍩', '🍰', '🧁', '🍿', '🥑', '🍓', '🍉', '🧀', '🥐'] },
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function EmojiPicker({ onEmojiSelect, externalOpen, onExternalOpenChange }: EmojiPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;
  const [search, setSearch] = useState('');

  const filteredGroups = search
    ? EMOJI_GROUPS.map(g => ({
        ...g,
        emojis: g.emojis.filter(() => g.label.toLowerCase().includes(search.toLowerCase())),
      })).filter(g => g.emojis.length > 0)
    : EMOJI_GROUPS;

  return (
    <>
      {externalOpen === undefined && (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Add emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm p-0 overflow-hidden gap-0 rounded-2xl z-[70]">
          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emojis..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>
          </div>

          {/* Emoji grid */}
          <div className="px-3 pb-3 max-h-72 overflow-y-auto overscroll-contain space-y-3" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            {filteredGroups.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-muted-foreground">No emojis found</p>
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {group.emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onEmojiSelect(emoji);
                          setOpen(false);
                          setSearch('');
                        }}
                        className="h-10 w-full flex items-center justify-center rounded-xl text-xl hover:bg-muted active:scale-90 transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
