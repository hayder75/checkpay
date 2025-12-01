import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import { authAPI } from '@/lib/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = auth.getToken();
      if (token && auth.isAuthenticated()) {
        try {
          // Verify token is still valid
          const response = await authAPI.getMe();
          // Update user data in case it changed
          if (response.data?.data) {
            auth.setUser(response.data.data);
          }
          setIsAuthenticated(true);
        } catch (error: any) {
          // Only logout on actual auth errors (401), not network errors
          if (error.response?.status === 401) {
            // Token invalid - clear it
            auth.removeToken();
            auth.removeUser();
            setIsAuthenticated(false);
          } else if (error.code === 'ERR_NETWORK') {
            // Network error - keep token but don't authenticate
            // This prevents redirect loops when backend is down
            console.warn('Network error during auth check, keeping token');
            setIsAuthenticated(false);
          } else {
            // Other errors - still allow access but log the error
            console.error('Auth check error:', error);
            setIsAuthenticated(true);
          }
        }
      } else {
        setIsAuthenticated(false);
      }
      setIsChecking(false);
    };
    checkAuth();
  }, []);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Save the attempted location to redirect after login
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}
