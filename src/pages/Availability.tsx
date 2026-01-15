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
    <div className="animate-fade-in space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Your Availability</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            Set when you're free and share with friends
          </p>
        </div>
        <Button onClick={handleShare} size="sm" className="gap-2 self-start sm:self-auto md:size-default">
          <Share2 className="h-4 w-4" />
          Share Availability
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
        <LocationToggle />
        <VibeSelector />
      </div>

      {/* Availability Grid */}
      <AvailabilityGrid />
    </div>
  );
}
