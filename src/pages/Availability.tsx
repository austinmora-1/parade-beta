import { AvailabilityGrid } from '@/components/availability/AvailabilityGrid';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';

export default function Availability() {
  return (
    <div className="animate-fade-in space-y-4 md:space-y-8">
      {/* Header - condensed on mobile */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold md:text-2xl">Availability</h1>
          <p className="hidden text-muted-foreground md:block">
            Set when you're free and share with friends
          </p>
        </div>
        <ShareDialog
          trigger={
            <Button size="sm" className="shrink-0 gap-2">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          }
        />
      </div>

      {/* Availability Grid */}
      <AvailabilityGrid />
    </div>
  );
}
