import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useConversations } from '@/hooks/useChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatView } from '@/components/chat/ChatView';
import { NewChatDialog } from '@/components/chat/NewChatDialog';

export default function Chat() {
  const { conversations, loading, createDM, createGroup } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);

  const activeConvo = conversations.find(c => c.id === activeId) || null;

  const handleCreateDM = async (friendUserId: string) => {
    const id = await createDM(friendUserId);
    if (id) setActiveId(id);
    return id;
  };

  const handleCreateGroup = async (title: string, memberIds: string[]) => {
    const id = await createGroup(title, memberIds);
    if (id) setActiveId(id);
    return id;
  };

  // Active conversation view (full screen on mobile)
  if (activeConvo) {
    return (
      <div className="animate-fade-in h-[calc(100dvh-7rem)] md:h-[calc(100dvh-8rem)]">
        <ChatView conversation={activeConvo} onBack={() => setActiveId(null)} />
      </div>
    );
  }

  // Conversation list
  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 md:h-12 md:w-12 md:rounded-2xl">
            <MessageCircle className="h-5 w-5 text-primary md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold md:text-xl">Messages</h1>
            <p className="text-xs text-muted-foreground md:text-sm">
              Chat with friends about plans
            </p>
          </div>
        </div>
        <NewChatDialog onCreateDM={handleCreateDM} onCreateGroup={handleCreateGroup} />
      </div>

      {/* List */}
      <div className="rounded-xl border border-border bg-card/50 p-3 md:rounded-2xl md:p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground animate-pulse">Loading chats...</p>
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
          />
        )}
      </div>
    </div>
  );
}
