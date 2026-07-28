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
      if (auth.isAuthenticated()) {
        try {
          // Verify token is still valid
          const response = await authAPI.getMe();
          // Check if response is successful
          if (response.data && response.data.success) {
          setIsAuthenticated(true);
          } else {
            // Invalid response
            auth.logout();
            setIsAuthenticated(false);
          }
        } catch (error: any) {
          // Token invalid or request failed
          console.error('Auth check failed:', error);
          auth.logout();
          setIsAuthenticated(false);
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
