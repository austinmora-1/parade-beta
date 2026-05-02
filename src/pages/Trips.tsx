import { Navigate } from 'react-router-dom';

/**
 * The standalone Trips tab has been merged into Plans.
 * This route now redirects to the Plans page with the Trips filter active.
 */
export default function Trips() {
  return <Navigate to="/availability?view=trips" replace />;
}
