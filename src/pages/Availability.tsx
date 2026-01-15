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
    <div className="animate-fade-in space-y-4 md:space-y-8">
      {/* Header - condensed on mobile */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold md:text-3xl">Availability</h1>
          <p className="hidden text-muted-foreground md:block">
            Set when you're free and share with friends
          </p>
        </div>
        <Button onClick={handleShare} size="sm" className="shrink-0 gap-2">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>

      {/* Availability Grid - now first */}
      <AvailabilityGrid />

      {/* Status Cards */}
      <div className="grid gap-3 sm:grid-cols-2 md:gap-6">
        <LocationToggle />
        <VibeSelector />
      </div>
    </div>
  );
}
