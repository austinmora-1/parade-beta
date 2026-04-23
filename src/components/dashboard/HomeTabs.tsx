import { IncomingOpenInvites } from './IncomingOpenInvites';
import { UpcomingTripsAndVisits } from './UpcomingTripsAndVisits';
import { UpcomingPlansWidget } from './UpcomingPlansWidget';

export function HomeTabs() {
  return (
    <div className="space-y-4">
      <IncomingOpenInvites />
      <UpcomingPlansWidget />
      <UpcomingTripsAndVisits />
    </div>
  );
}
