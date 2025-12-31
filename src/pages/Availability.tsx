import { AvailabilityGrid } from '@/components/availability/AvailabilityGrid';
import { LocationToggle } from '@/components/dashboard/LocationToggle';
import { VibeSelector } from '@/components/dashboard/VibeSelector';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Availability() {
  const { toast } = useToast();

  const handleShare = () => {
    toast({
      title: 'Share link copied!',
      description: 'Your availability snapshot has been copied to clipboard.',
    });
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Your Availability</h1>
          <p className="mt-1 text-muted-foreground">
            Set when you're free and share with friends
          </p>
        </div>
        <Button onClick={handleShare} className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Availability
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LocationToggle />
        <VibeSelector />
      </div>

      {/* Availability Grid */}
      <AvailabilityGrid />
    </div>
  );
}
