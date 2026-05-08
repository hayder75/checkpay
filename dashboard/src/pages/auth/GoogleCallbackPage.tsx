import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '@/lib';

export default function GoogleCallbackPage() {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get('token');
    const userB64 = params.get('user');
    const error = params.get('error');

    // Check for errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      navigate('/auth/login', { replace: true });
      return;
    }

    if (token && userB64) {
      try {
        // Decode base64url
        const padded = userB64.replace(/-/g, '+').replace(/_/g, '/');
        const userJson = atob(padded);
        const user = JSON.parse(userJson);
        auth.setToken(token);
        auth.setUser(user);
        
        // If role is USER (new Google OAuth user), redirect to role selection
        if (user.role === 'USER') {
          navigate('/auth/select-role', { replace: true });
        } else {
          // Existing user or already has a role, go to dashboard
          navigate('/dashboard', { replace: true });
        }
        return;
      } catch (error) {
        console.error('Failed to parse Google callback user', error);
      }
    }

    navigate('/auth/login', { replace: true });
  }, [search, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-muted-foreground">Completing Google sign-in...</div>
    </div>
  );
}

