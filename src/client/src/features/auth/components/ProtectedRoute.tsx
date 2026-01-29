import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
  requireBusiness?: string; // Optional: require membership in specific business
}

export function ProtectedRoute({ children, requireBusiness }: Props) {
  const { isAuthenticated, isLoading, businesses } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireBusiness && !businesses.some(b => b.slug === requireBusiness)) {
    return <Navigate to="/404" replace />;
  }

  return <>{children}</>;
}
