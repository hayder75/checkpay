import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AcceptTransferPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<'code' | 'account'>('code');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    businessId: '',
  });

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a valid 6-digit transfer code',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Validate code first (we'll check if it exists)
      setStep('account');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Invalid transfer code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username && !formData.email && !formData.phone) {
      toast({
        title: 'Required Field',
        description: 'Please provide username, email, or phone number',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.password) {
      toast({
        title: 'Password Required',
        description: 'Password is required to create your account',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await projectAPI.acceptTransfer({
        code,
        username: formData.username || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        password: formData.password,
        businessId: formData.businessId || undefined,
      });

      if (response.data.success) {
        toast({
          title: 'Success!',
          description: 'Project transferred successfully! You can now login to access it.',
        });
        
        // Redirect to login
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: 'Transfer Failed',
        description: error.response?.data?.error || 'Failed to accept transfer',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F37100] to-[#FF8C42] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Project Transfer</CardTitle>
          <CardDescription>
            {step === 'code' 
              ? 'Enter the 6-digit transfer code from your developer'
              : 'Create your account to receive the project'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'code' ? (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Transfer Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  required
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the 6-digit code provided by your developer
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                {loading ? 'Validating...' : 'Continue'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAcceptTransfer} className="space-y-4">
              <div>
                <Label htmlFor="username">Username (Optional)</Label>
                <Input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="johndoe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep('code')} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Processing...' : 'Accept Transfer'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

