import { Navigate, useParams } from 'react-router';

// The old app had a separate edit address for vehicles.
export function VehicleEditRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/vehicles/${encodeURIComponent(id)}`} replace />;
}
