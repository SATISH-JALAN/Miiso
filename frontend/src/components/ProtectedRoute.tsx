/**
 * ProtectedRoute — Gates app pages behind wallet + setup requirements.
 * 
 * Behavior:
 * - Not connected → redirect to /setup
 * - Connected but setup incomplete → allow read-only access (Dashboard gets a banner)
 * - Connected + setup complete → full access
 */
import { Navigate, useLocation } from "react-router-dom";
import { useStore } from "../store/index";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If true, requires full setup completion (for Settings, etc.) */
  requireSetup?: boolean;
}

export function ProtectedRoute({ children, requireSetup = false }: ProtectedRouteProps) {
  const isConnected = useStore((s) => s.isConnected);
  const setupComplete = useStore((s) => s.setupComplete);
  const location = useLocation();

  // Not connected at all → redirect to /setup
  if (!isConnected) {
    return <Navigate to="/setup" state={{ from: location.pathname }} replace />;
  }

  // Connected but setup not complete + this route requires setup → redirect to /setup
  if (requireSetup && !setupComplete) {
    return <Navigate to="/setup" state={{ from: location.pathname }} replace />;
  }

  // Connected (possibly without setup) → render children
  // Individual pages handle the read-only state via setupComplete flag
  return <>{children}</>;
}
