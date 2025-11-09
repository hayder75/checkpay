import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if already logged in - persist session
  useEffect(() => {
    const checkAuth = async () => {
      const token = auth.getToken();
      if (token && auth.isAuthenticated()) {
        try {
          // Check if token is still valid by trying to get user info
          const response = await authAPI.getMe();
          // Token is valid, user is logged in - redirect based on role
          auth.setUser(response.data.data);
          const userRole = response.data.data.role;
          if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            navigate('/admin/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } catch (error: any) {
          // Token invalid or expired, or CORS error - clear it
          console.error('Auth check failed:', error);
          if (error.code !== 'ERR_NETWORK' && error.response?.status !== 401) {
            // Only clear on actual auth errors, not network errors
            auth.logout();
          }
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() && !username.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your phone number or username',
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
      // Try password login first
      const response = await authAPI.login({
        phone: phone.trim() || undefined,
        username: username.trim() || undefined,
        password: password.trim(),
      });

      const { token, user } = response.data.data;
      auth.setToken(token);
      auth.setUser(user);
      
      toast({
        title: 'Success',
        description: 'Logged in successfully!',
      });

      // Redirect based on role
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      // If login fails, check if user doesn't have password
      if (error.response?.data?.error?.includes('Please verify your account with OTP')) {
        // User doesn't have password - send OTP
        try {
          const registerResponse = await authAPI.register({ 
            phone: phone.trim() || undefined, 
            username: username.trim() || undefined 
          });
          
          if (registerResponse.data.data.debug?.otp) {
            console.log(`\n🔐 ==========================================`);
            console.log(`📱 OTP Code: ${registerResponse.data.data.debug.otp}`);
            console.log(`⏰ Use this code to verify your account`);
            console.log(`🔐 ==========================================\n`);
          }
          
          toast({
            title: 'Password Not Set',
            description: 'Please verify with OTP to set your password. Check console (F12) for OTP.',
          });
          navigate('/auth/verify-otp', { state: { phone: phone.trim() || undefined } });
        } catch (regError: any) {
          toast({
            title: 'Error',
            description: error.response?.data?.error || 'Invalid credentials or account not found',
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Error',
          description: error.response?.data?.error || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your CheckPay account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter either username or phone number, and your password. If you don't have a password, you'll be redirected to set one.
            </p>
            <Button
              type="submit"
              className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
              disabled={loading || (!username && !phone) || !password}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <div className="text-center text-sm">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-[#F37100] hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
