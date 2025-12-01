import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI, countriesAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { InteractiveBackground } from '@/components/landing/InteractiveBackground';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load countries
    console.log('Loading countries from API...');
    countriesAPI.getAll()
      .then((res) => {
        console.log('Countries API response:', res);
        console.log('Response data:', res.data);
        if (res.data && res.data.success && res.data.data) {
          const countriesList = res.data.data;
          console.log('Countries loaded:', countriesList.length, 'countries');
          setCountries(countriesList);
        } else {
          console.error('Countries API returned unexpected format:', res.data);
        }
      })
      .catch((error) => {
        console.error('Error loading countries:', error);
        console.error('Error details:', error.response?.data || error.message);
        toast({
          title: 'Warning',
          description: 'Could not load countries. You can still register without selecting a country.',
          variant: 'default',
        });
      });
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.register({
        username: username || undefined,
        phone: phone || undefined,
        country: country || undefined,
      });

      // Log OTP to frontend console for testing
      if (response.data.data.debug?.otp) {
        console.log(`\n🔐 ==========================================`);
        console.log(`📱 OTP Code: ${response.data.data.debug.otp}`);
        console.log(`⏰ Use this code to verify your account`);
        console.log(`🔐 ==========================================\n`);
      }

      // Check if account already exists
      if (response.data.data.exists) {
        toast({
          title: 'Account Exists',
          description: response.data.message || 'Account already exists. OTP sent for login.',
        });
        // If phone provided, navigate to OTP verification
        if (phone) {
          navigate('/auth/verify-otp', { state: { phone } });
        }
        return;
      }

      // New account created
      if (response.data.data.message) {
        // OTP sent for phone
        toast({
          title: 'Success',
          description: 'OTP sent to your phone',
        });
        navigate('/auth/verify-otp', { state: { phone } });
      } else if (response.data.data.token) {
        // Registration successful
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        toast({
          title: 'Success',
          description: 'Account created successfully!',
        });
        navigate('/dashboard');
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
    <div className="min-h-screen relative overflow-hidden">
      <InteractiveBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-md border-border/50 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
            <CardDescription className="text-center">
              Get started with CheckPay today
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                />
                <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country (Optional)</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select your country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                At least one of username or phone is required. Country helps improve pattern accuracy.
              </p>
              <Button
                type="submit"
                className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
                disabled={loading || (!username && !phone)}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link to="/auth/login" className="text-[#F37100] hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
