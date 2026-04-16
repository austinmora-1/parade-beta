import { UpcomingTripsAndVisits } from './UpcomingTripsAndVisits';
import { UpcomingPlansWidget } from './UpcomingPlansWidget';

export function HomeTabs() {
  return (
    <div className="space-y-4">
      <UpcomingPlansWidget />
      <UpcomingTripsAndVisits />
    </div>
  );
}
