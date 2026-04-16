import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function DeleteAccountDialog() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [botAnswer, setBotAnswer] = useState('');

  // Generate a simple random math problem as bot test
  const challenge = useMemo(() => {
    const a = Math.floor(Math.random() * 10) + 2;
    const b = Math.floor(Math.random() * 10) + 1;
    return { a, b, answer: a + b };
  }, [open]); // regenerate when dialog opens

  const isCorrect = botAnswer.trim() === String(challenge.answer);

  const handleDelete = async () => {
    if (!session?.access_token || !isCorrect) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      toast.success('Your account has been deleted.');
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBotAnswer(''); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete your account?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              This will <strong className="text-foreground">permanently delete</strong> all your data including your profile, plans, availability, messages, vibes, and friendships. This action cannot be undone.
            </span>
            <span className="block text-sm font-medium text-foreground">
              To confirm you're not a bot, what is {challenge.a} + {challenge.b}?
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          type="text"
          inputMode="numeric"
          placeholder="Enter your answer"
          value={botAnswer}
          onChange={(e) => setBotAnswer(e.target.value)}
          className="mt-1"
          autoFocus
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isCorrect || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Permanently Delete Account'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export default DeleteAccountDialog;
