import { useParams } from 'react-router-dom';
import { FriendProfileContent } from '@/components/friends/FriendProfileContent';
import { useConversations } from '@/hooks/useChat';
import { useNavigate } from 'react-router-dom';

export default function FriendProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { createDM } = useConversations();

  if (!userId) {
    return (
      <div className="animate-fade-in space-y-4 text-center py-12">
        <p className="text-4xl">🔒</p>
        <h2 className="font-display text-lg font-semibold">Profile not available</h2>
        <p className="text-sm text-muted-foreground">This user's profile is private or doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <FriendProfileContent
        userId={userId}
        showBackButton={true}
        onMessageClick={async () => {
          const id = await createDM(userId);
          if (id) navigate('/interact');
        }}
      />
    </div>
  );
}
