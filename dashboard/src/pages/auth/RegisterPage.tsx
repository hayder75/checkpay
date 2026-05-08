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
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { COUNTRIES_LIST, type Country } from '@/utils/countries';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [role, setRole] = useState<'DEVELOPER' | 'BUSINESS_OWNER'>('DEVELOPER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const loginLogoPath = theme === 'dark' ? '/login-signup-logo.png' : '/login-signup-logo-light.png';

  // Get selected country details
  const selectedCountry = countryCode ? COUNTRIES_LIST.find(c => c.callingCode === countryCode) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (password && password !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (!country) {
      toast({
        title: 'Error',
        description: 'Please select your country',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Combine country code and phone number
      const fullPhone = countryCode && phoneNumber 
        ? `${countryCode}${phoneNumber.replace(/^\+/, '')}` 
        : undefined;

      const response = await authAPI.register({
        username: username || undefined,
        phone: fullPhone,
        password: password,
        role: role,
        country: country || undefined,
      });

      if (response.data.data.token && response.data.data.user) {
        const { token, user } = response.data.data;
        auth.setToken(token);
        auth.setUser(user);
        toast({
          title: 'Success',
          description: 'Account created successfully!',
        });
        navigate('/dashboard');
      } else {
        toast({
          title: 'Success',
          description: 'Account created. Please log in.',
        });
        navigate('/auth/login');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || error.message || 'Registration failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden py-12">
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

      {/* Register Card */}
      <Card className="w-full max-w-2xl relative z-10 bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <img 
              src={loginLogoPath} 
              alt="CheckPay Logo" 
              className="h-24 w-auto"
            />
          </div>
          <CardTitle className="text-3xl font-bold">Create an account</CardTitle>
          <CardDescription className="text-base">
            Get started with CheckPay today - No license required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username (Optional)</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  minLength={3}
                  maxLength={30}
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
                    setCountry(selectedCode);
                    // Auto-select country code when country is selected
                    if (selectedCode) {
                      const selectedCountryData = COUNTRIES_LIST.find((c) => c.code === selectedCode);
                      if (selectedCountryData?.callingCode) {
                        setCountryCode(selectedCountryData.callingCode);
                      }
                    } else {
                      setCountryCode('');
                    }
                  }}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select your country</option>
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Required - Improves pattern matching accuracy and helps organize templates
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country Code (Optional)</Label>
                <select
                  id="countryCode"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select code</option>
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c.code} value={c.callingCode}>
                      {c.callingCode} ({c.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder={selectedCountry ? `e.g., 712345678` : "e.g., 712345678"}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d]/g, ''))}
                  className="bg-background/50"
                />
                {countryCode && (
                  <p className="text-xs text-muted-foreground">
                    Full number: {countryCode}{phoneNumber || '...'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Account Type *</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'DEVELOPER' | 'BUSINESS_OWNER')}
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="DEVELOPER">Developer - Build projects and patterns</option>
                <option value="BUSINESS_OWNER">Business Owner - Manage businesses and employees</option>
              </select>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                {role === 'DEVELOPER'
                  ? '✓ Create projects, patterns, and use all features'
                  : '✓ Manage businesses, employees, and access codes'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="bg-background/50"
                />
              </div>
              {password && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    className="bg-background/50"
                  />
                </div>
              )}
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
                <CheckCircle2 className="w-4 h-4" />
                What you get:
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• Free API access with no license fees</li>
                <li>• All transactions automatically saved</li>
                <li>• 30+ African countries supported</li>
                <li>• AI-powered SMS parsing</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              At least one of username or phone is required
            </p>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30"
              disabled={loading || (!username && !phoneNumber) || !country}
            >
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

            <Button
              type="button"
              variant="outline"
              className="w-full border-2"
              onClick={async () => {
                setGoogleLoading(true);
                // Passport.js handles the redirect directly
                // Just redirect to the backend endpoint which will redirect to Google
                const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                window.location.href = `${apiBaseUrl}/auth/google`;
              }}
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
            Already have an account?{' '}
            <Link to="/auth/login" className="text-orange-600 dark:text-orange-400 hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
