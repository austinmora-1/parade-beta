import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { FriendProfileContent } from './FriendProfileContent';
import { ChatView } from '@/components/chat/ChatView';
import { useConversations, Conversation } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence, motion } from 'framer-motion';

interface FriendPanelProps {
  friendUserId: string | null;
  initialConversationId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'profile' | 'chat';
}

function ChatEmptyState({
  friendUserId,
  onConversationCreated,
}: {
  friendUserId: string;
  onConversationCreated: (conversationId: string) => void;
}) {
  const { createDM } = useConversations();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [friendProfile, setFriendProfile] = useState<{ name: string; avatar: string | null }>({ name: 'Friend', avatar: null });

  useEffect(() => {
    supabase
      .from('public_profiles')
      .select('display_name, avatar_url')
      .eq('user_id', friendUserId)
      .single()
      .then(({ data }) => {
        if (data) setFriendProfile({ name: data.display_name || 'Friend', avatar: data.avatar_url });
      });
  }, [friendUserId]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const id = await createDM(friendUserId);
    if (id) {
      // Send the first message
      await supabase.from('chat_messages').insert({
        conversation_id: id,
        sender_id: (await supabase.auth.getUser()).data.user?.id!,
        content: input.trim(),
      });
      onConversationCreated(id);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Avatar className="h-16 w-16">
          <AvatarImage src={friendProfile.avatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-lg font-display">
            {friendProfile.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{friendProfile.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Send a message to start chatting</p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border bg-background p-3 shrink-0">
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 rounded-lg text-sm !text-[16px] md:!text-sm"
        />
        <Button onClick={handleSend} disabled={!input.trim() || sending} size="sm" className="rounded-lg">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PanelContent({
  friendUserId,
  initialConversationId,
  onClose,
  defaultTab = 'profile',
  onTabChange,
}: {
  friendUserId: string;
  initialConversationId?: string | null;
  onClose: () => void;
  defaultTab?: 'profile' | 'chat';
  onTabChange?: (tab: 'profile' | 'chat') => void;
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'chat'>(defaultTab);

  const handleTabChange = (tab: 'profile' | 'chat') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const { conversations } = useConversations();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);

  // Try to find existing DM if initialConversationId not provided
  useEffect(() => {
    if (conversationId) return;
    const dm = conversations.find(c => {
      if (c.type !== 'dm') return false;
      return c.participants.some(p => p.user_id === friendUserId);
    });
    if (dm) setConversationId(dm.id);
  }, [conversations, friendUserId, conversationId]);

  const activeConversation: Conversation | null = conversations.find(c => c.id === conversationId) || null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(['profile', 'chat'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'profile' ? 'Profile' : 'Chat'}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'profile' ? (
          <div className="p-4">
            <FriendProfileContent
              userId={friendUserId}
              showBackButton={false}
              onMessageClick={() => setActiveTab('chat')}
            />
          </div>
        ) : activeConversation ? (
          <div className="h-full px-4 pt-2 pb-0">
            <ChatView
              conversation={activeConversation}
              onBack={onClose}
              inlineMode
            />
          </div>
        ) : (
          <ChatEmptyState
            friendUserId={friendUserId}
            onConversationCreated={(id) => setConversationId(id)}
          />
        )}
      </div>
    </div>
  );
}

export function FriendPanel({ friendUserId, initialConversationId, open, onOpenChange, defaultTab }: FriendPanelProps) {
  const isMobile = useIsMobile();

  if (!friendUserId) return null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] flex flex-col">
          <PanelContent
            friendUserId={friendUserId}
            initialConversationId={initialConversationId}
            onClose={() => onOpenChange(false)}
            defaultTab={defaultTab}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-background border-l border-border shadow-xl z-50 flex flex-col"
          >
            <PanelContent
              friendUserId={friendUserId}
              initialConversationId={initialConversationId}
              onClose={() => onOpenChange(false)}
              defaultTab={defaultTab}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
