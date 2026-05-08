import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import GeometricBackground from '@/components/GeometricBackground';
import { useTheme } from '@/contexts/ThemeContext';
import { Sparkles, ArrowLeft, User, Lock, Info } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showTestCredentials, setShowTestCredentials] = useState(false);
  const loginLogoPath = theme === 'dark' ? '/login-signup-logo.png' : '/login-signup-logo-light.png';

  // Auto-login removed - users can now open multiple accounts in different tabs
  // No automatic redirect on login page load

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your username, email, or phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!password.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your password',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const identifierValue = identifier.trim();
      const isEmail = identifierValue.includes('@');
      const isPhone = /^\+?[\d\s-()]+$/.test(identifierValue) && identifierValue.length >= 10;
      
      const response = await authAPI.login({
        phone: isPhone ? identifierValue : undefined,
        username: (!isEmail && !isPhone && identifierValue) ? identifierValue : undefined,
        email: (isEmail && identifierValue) ? identifierValue : undefined,
        password: password.trim(),
      });

      const { token, user } = response.data.data;
      auth.setToken(token);
      auth.setUser(user);

      toast({
        title: 'Success',
        description: 'Logged in successfully!',
      });

      // Use window.location.href to force full page reload and ensure sessionStorage is read
      // This ensures ProtectedRoute can properly read the token
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    // Passport.js handles the redirect directly
    // Just redirect to the backend endpoint which will redirect to Google
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated Geometric Background */}
      <GeometricBackground />

      {/* Back to Home */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-10 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to Home</span>
      </Link>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <img 
              src={loginLogoPath} 
              alt="CheckPay Logo" 
              className="h-24 w-auto"
            />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-base">
            Sign in to your CheckPay account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Credentials Info */}
          {import.meta.env.DEV && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <button
                type="button"
                onClick={() => setShowTestCredentials(!showTestCredentials)}
                className="w-full flex items-center justify-between text-sm text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span className="font-medium">Test Credentials</span>
                </div>
                <span className="text-xs">{showTestCredentials ? 'Hide' : 'Show'}</span>
              </button>
              {showTestCredentials && (
                <div className="mt-3 space-y-2 text-xs text-blue-600 dark:text-blue-400">
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="font-semibold mb-1">Admin User:</div>
                    <div>Username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin</code></div>
                    <div>Password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">admin123</code></div>
                    <div className="text-blue-500 dark:text-blue-400 mt-1">Role: ADMIN | Plan: PREMIUM</div>
                  </div>
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="font-semibold mb-1">Developer User 1:</div>
                    <div>Username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">testdev</code></div>
                    <div>Phone: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">+251900000000</code></div>
                    <div>Password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">testdev123</code></div>
                    <div className="text-blue-500 dark:text-blue-400 mt-1">Role: DEVELOPER | Plan: FREE</div>
                  </div>
                  <div className="bg-white dark:bg-blue-900/50 p-2 rounded border border-blue-200 dark:border-blue-700">
                    <div className="font-semibold mb-1">Developer User 2:</div>
                    <div>Username: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">testdev2</code></div>
                    <div>Email: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">testdev2@checkpay.com</code></div>
                    <div>Phone: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">+251900000001</code></div>
                    <div>Password: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">testdev123</code></div>
                    <div className="text-blue-500 dark:text-blue-400 mt-1">Role: DEVELOPER | Plan: FREE</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Username, Email, or Phone
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="admin, admin@checkpay.com, or +251900000000"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-background/50"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
                autoComplete="current-password"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              You can login with your username, email address, or phone number.
            </p>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30"
              disabled={loading || !identifier || !password}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-2"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </Button>
          </form>

          <div className="text-center text-sm">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-orange-600 dark:text-orange-400 hover:underline font-semibold">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
