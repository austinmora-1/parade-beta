import { MessageSquareMore } from 'lucide-react';
import { useFeedback } from './FeedbackContext';

export function FloatingFeedbackButton() {
  const { openFeedback } = useFeedback();

  return (
    <button
      onClick={openFeedback}
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      aria-label="Send feedback"
    >
      <MessageSquareMore className="h-5 w-5" />
    </button>
  );
}
