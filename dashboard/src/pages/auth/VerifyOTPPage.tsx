import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authAPI, auth } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [phone] = useState((location.state as any)?.phone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!phone) {
      navigate('/auth/register');
    }
    // Start 60 second countdown when page loads
    setCountdown(60);
  }, [phone, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.verifyOTP({ phone, code });
      const { token, user } = response.data.data;
      auth.setToken(token);
      auth.setUser(user);
      toast({
        title: 'Success',
        description: 'Account verified successfully!',
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Invalid OTP code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    try {
      const response = await authAPI.resendOTP({ phone });
      
      // Log OTP to frontend console for testing
      if (response.data.debug?.otp) {
        console.log(`\n🔐 ==========================================`);
        console.log(`📱 OTP Code: ${response.data.debug.otp}`);
        console.log(`⏰ Use this code to verify your account`);
        console.log(`🔐 ==========================================\n`);
      }
      
      toast({
        title: 'OTP Resent',
        description: 'A new OTP has been sent. Check the browser console (F12).',
      });
      setCountdown(60); // Reset countdown
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to resend OTP',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Verify OTP</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code sent to {phone}
          </CardDescription>
          <CardDescription className="text-center text-xs text-muted-foreground">
            Check the browser console (F12) for the OTP code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">OTP Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                required
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t">
            <div className="text-center text-sm text-muted-foreground mb-2">
              Didn't receive the code?
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendOTP}
              disabled={resending || countdown > 0}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
              {resending
                ? 'Resending...'
                : countdown > 0
                ? `Resend OTP (${countdown}s)`
                : 'Resend OTP'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
