import { useState } from 'react';
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
import { X, Menu, User, Lock } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';
  const loginLogoPath = theme === 'dark' ? '/login-signup-logo.png' : '/login-signup-logo-light.png';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast({ title: 'Error', description: 'Please enter your username, email, or phone number', variant: 'destructive' });
      return;
    }
    if (!password.trim()) {
      toast({ title: 'Error', description: 'Please enter your password', variant: 'destructive' });
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
      toast({ title: 'Success', description: 'Logged in successfully!' });
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Invalid credentials', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <GeometricBackground />

      <header className="sticky top-0 z-[100] border-b border-border/50 bg-background/90">
        <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 py-3 md:py-4 flex items-center justify-between">
          <Link to="/">
            <img src={logoPath} alt="CheckPay Logo" className="h-8 md:h-10 w-auto object-contain flex-shrink-0" />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Products</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <div className="w-px h-5 bg-border mx-2" />
            <ThemeToggle />
            <Link to="/auth/register">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-sm px-5">
                Get Started
              </Button>
            </Link>
          </nav>
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground hover:text-foreground">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="w-full px-4 sm:px-8 py-5 space-y-3">
              <Link to="/api-docs" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Docs</div>
              </Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Products</div>
              </Link>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Pricing</div>
              </Link>
              <div className="border-t border-border my-3" />
              <Link to="/auth/register" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm mt-2">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <div className="min-h-[calc(100vh-4rem)] flex relative z-10">
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <img src={loginLogoPath} alt="CheckPay Logo" className="h-20 w-auto" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-muted-foreground mt-2">Sign in to your CheckPay account</p>
            </div>

            <Card className="border-border/50 shadow-lg">
              <CardContent className="p-6 space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="flex items-center gap-2 text-sm font-medium">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Username, Email, or Phone
                    </Label>
                    <Input id="identifier" type="text" placeholder="admin, admin@checkpay.com, or +251900000000" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="bg-background/50 h-11 text-sm" autoComplete="username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                      Password
                    </Label>
                    <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/50 h-11 text-sm" autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm h-11 text-sm font-medium" disabled={loading || !identifier || !password}>
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
                  <Button type="button" variant="outline" className="w-full border-2 h-11 text-sm font-medium" onClick={handleGoogle} disabled={googleLoading}>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {googleLoading ? 'Redirecting...' : 'Continue with Google'}
                  </Button>
                </form>
                <div className="text-center text-sm pt-2">
                  Don't have an account?{' '}
                  <Link to="/auth/register" className="text-primary hover:text-primary/80 hover:underline font-semibold">
                    Sign up
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              {[
                { value: '200ms', label: 'Verification' },
                { value: '30+', label: 'Countries' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="text-sm font-bold text-foreground">{stat.value}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-muted/20 border-l border-border items-center justify-center px-12">
          <div className="max-w-sm space-y-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-3">Why CheckPay?</h2>
              <p className="text-muted-foreground leading-relaxed">
                Verify payments across Africa with a single API. No banking license required.
              </p>
            </div>
            <div className="space-y-6">
              {[
                { title: 'Real-time verification', description: 'Know if a payment is confirmed in under 200ms.' },
                { title: '30+ countries', description: 'Coverage across African mobile networks and banks.' },
                { title: 'No license needed', description: 'Start building immediately without regulatory hurdles.' },
                { title: 'Developer-first APIs', description: 'Clean REST API with SDKs for Node, Python, PHP.' },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-6">
              <p className="text-sm text-muted-foreground italic">
                "CheckPay saved us months of building payment verification infrastructure. We went from idea to production in a week."
              </p>
              <p className="text-sm font-semibold mt-3">— Developer, Fintech Startup</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
