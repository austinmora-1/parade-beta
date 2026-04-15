import { useParams } from 'react-router-dom';
import { FriendProfileContent } from '@/components/friends/FriendProfileContent';

export default function FriendProfile() {
  const { userId } = useParams<{ userId: string }>();

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
      />
    </div>
  );
}
