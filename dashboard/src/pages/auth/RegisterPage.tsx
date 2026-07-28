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
import { X, Menu, CheckCircle2 } from 'lucide-react';
import { COUNTRIES_LIST } from '@/utils/countries';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [role, setRole] = useState<'DEVELOPER' | 'BUSINESS_OWNER'>('DEVELOPER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const logoPath = theme === 'dark' ? '/dark-theme-logo.png' : '/light-theme-logo.png';
  const loginLogoPath = theme === 'dark' ? '/login-signup-logo.png' : '/login-signup-logo-light.png';

  const selectedCountry = countryCode ? COUNTRIES_LIST.find(c => c.callingCode === countryCode) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (password && password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!country) {
      toast({ title: 'Error', description: 'Please select your country', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fullPhone = countryCode && phoneNumber ? `${countryCode}${phoneNumber.replace(/^\+/, '')}` : undefined;
      const response = await authAPI.register({ username: username || undefined, phone: fullPhone, password, role, country: country || undefined });
      if (response.data.data.token && response.data.data.user) {
        const { token, user } = response.data.data;
        auth.setToken(token);
        auth.setUser(user);
        toast({ title: 'Success', description: 'Account created successfully!' });
        navigate('/dashboard');
      } else {
        toast({ title: 'Success', description: 'Account created. Please log in.' });
        navigate('/auth/login');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.error || error.message || 'Registration failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-sm">Login</Button>
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
              <Link to="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <div className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors">Login</div>
              </Link>
            </div>
          </div>
        )}
      </header>

      <div className="flex items-center justify-center px-4 py-8 md:py-12 relative z-10">
        <Card className="w-full max-w-lg relative bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
          <CardHeader className="space-y-1 text-center pb-3">
            <div className="flex justify-center mb-3">
              <img src={loginLogoPath} alt="CheckPay Logo" className="h-16 w-auto" />
            </div>
            <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
            <CardDescription className="text-sm">
              Get started with CheckPay today - No license required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-sm">Username <span className="text-muted-foreground/60">(optional)</span></Label>
                  <Input id="username" type="text" placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} minLength={3} maxLength={30} className="bg-background/50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-sm">Country <span className="text-destructive">*</span></Label>
                  <select id="country" value={country} onChange={(e) => { const c = e.target.value; setCountry(c); if (c) { const d = COUNTRIES_LIST.find(x => x.code === c); if (d?.callingCode) setCountryCode(d.callingCode); } else setCountryCode(''); }} required className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Select country</option>
                    {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="countryCode" className="text-sm">Code <span className="text-muted-foreground/60">(optional)</span></Label>
                  <select id="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Code</option>
                    {COUNTRIES_LIST.map(c => <option key={c.code} value={c.callingCode}>{c.callingCode} ({c.name})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-sm">Phone <span className="text-muted-foreground/60">(optional)</span></Label>
                  <Input id="phoneNumber" type="tel" placeholder={selectedCountry ? `e.g., 712345678` : "e.g., 712345678"} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ''))} className="bg-background/50 h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-sm">Account Type <span className="text-destructive">*</span></Label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'DEVELOPER' | 'BUSINESS_OWNER')} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="DEVELOPER">Developer - Build projects and patterns</option>
                  <option value="BUSINESS_OWNER">Business Owner - Manage businesses and employees</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm">Password <span className="text-destructive">*</span></Label>
                  <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} className="bg-background/50 h-9 text-sm" />
                </div>
                {password && (
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-sm">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} className="bg-background/50 h-9 text-sm" />
                  </div>
                )}
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  What you get:
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 ml-5">
                  <li>Free API access with no license fees</li>
                  <li>All transactions automatically saved</li>
                  <li>30+ African countries supported</li>
                </ul>
              </div>

              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm h-9 text-sm" disabled={loading || (!username && !phoneNumber) || !country}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button type="button" variant="outline" className="w-full border-2 h-9 text-sm" onClick={async () => { setGoogleLoading(true); const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'; window.location.href = `${apiBaseUrl}/auth/google`; }} disabled={googleLoading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </Button>
            </form>
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-primary hover:text-primary/80 hover:underline font-semibold">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
