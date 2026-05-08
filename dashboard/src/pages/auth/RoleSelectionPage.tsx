import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import GeometricBackground from '@/components/GeometricBackground';
import { useTheme } from '@/contexts/ThemeContext';
import { Code, Building2, User, Globe } from 'lucide-react';
import { COUNTRIES_LIST } from '@/utils/countries';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [selectedRole, setSelectedRole] = useState<'DEVELOPER' | 'BUSINESS_OWNER'>('DEVELOPER');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const loginLogoPath = theme === 'dark' ? '/login-signup-logo.png' : '/login-signup-logo-light.png';

  // Initialize username from current user
  useEffect(() => {
    const currentUser = auth.getUser();
    if (currentUser?.username) {
      setUsername(currentUser.username);
    } else if (currentUser?.email) {
      // Default username from email if not set
      const emailName = currentUser.email.split('@')[0];
      setUsername(emailName.replace(/[^a-zA-Z0-9_]/g, ''));
    }
    if (currentUser?.country) {
      setCountry(currentUser.country);
    }
  }, []);

  const handleSubmit = async () => {
    if (!username || username.length < 3) {
      toast({
        title: 'Error',
        description: 'Username must be at least 3 characters',
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
      // Update user role, username, and country
      const response = await authAPI.updateRole({
        role: selectedRole,
        username,
        country
      });

      // Update user in local storage with the response from server
      if (response.data?.data) {
        auth.setUser(response.data.data);
      } else {
        // Fallback: update with selected data
        const currentUser = auth.getUser();
        if (currentUser) {
          const updatedUser = { ...currentUser, role: selectedRole, username, country };
          auth.setUser(updatedUser);
        }
      }

      // Fetch fresh user data from API to ensure cache is cleared
      try {
        const meResponse = await authAPI.getMe();
        if (meResponse.data?.data) {
          auth.setUser(meResponse.data.data);
        }
      } catch (meError) {
        // If getMe fails, continue with the role update response
        console.warn('Failed to fetch updated user data:', meError);
      }

      toast({
        title: 'Success',
        description: `Account set up as ${selectedRole === 'DEVELOPER' ? 'Developer' : 'Business Owner'}`,
      });

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to set account type',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Animated Geometric Background */}
      <GeometricBackground />

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Role Selection Card */}
      <Card className="w-full max-w-2xl relative z-10 bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-6">
            <img
              src={loginLogoPath}
              alt="CheckPay Logo"
              className="h-24 w-auto"
            />
          </div>
          <CardTitle className="text-3xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription className="text-base">
            Just a few more details to get you started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username and Country Inputs */}
          <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#F37100]" />
                Username
              </Label>
              <Input
                id="username"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                className="bg-background/50"
              />
              <p className="text-[10px] text-muted-foreground">3-30 chars, letters, numbers, underscores</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#F37100]" />
                Country
              </Label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select your country</option>
                {COUNTRIES_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">Helps with pattern accuracy</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Account Type</Label>
            {/* Developer Option */}
            <button
              type="button"
              onClick={() => setSelectedRole('DEVELOPER')}
              className={`w-full p-6 rounded-lg border-2 text-left transition-all ${selectedRole === 'DEVELOPER'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                  : 'border-border hover:border-orange-300 bg-background'
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${selectedRole === 'DEVELOPER'
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted'
                  }`}>
                  <Code className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Developer</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Build projects, create patterns, and integrate CheckPay into your applications
                  </p>
                </div>
                {selectedRole === 'DEVELOPER' && (
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>

            {/* Business Owner Option */}
            <button
              type="button"
              onClick={() => setSelectedRole('BUSINESS_OWNER')}
              className={`w-full p-6 rounded-lg border-2 text-left transition-all ${selectedRole === 'BUSINESS_OWNER'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                  : 'border-border hover:border-orange-300 bg-background'
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${selectedRole === 'BUSINESS_OWNER'
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted'
                  }`}>
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Business Owner</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Manage your business, employees, and track transactions
                  </p>
                </div>
                {selectedRole === 'BUSINESS_OWNER' && (
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#F37100] hover:bg-[#F37100]/90 text-white"
            size="lg"
          >
            {loading ? 'Setting up account...' : 'Continue'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You can change this later from your account settings (admin approval required)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

