import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { employeeAPI } from '@/lib';
import { useToast } from '@/components/ui/use-toast';
import { Key, QrCode, UserPlus } from 'lucide-react';

export default function EmployeeRegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    qrData: '',
    name: '',
  });
  const [, setShowQRScanner] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await employeeAPI.register({
        code: formData.code || undefined,
        qrData: formData.qrData || undefined,
        name: formData.name,
      });
      toast({
        title: 'Success',
        description: 'Employee registration successful! You can now log in.',
      });
      navigate('/auth/login');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to register as employee',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // QR scanner handler - can be implemented when QR scanner component is added
  // const handleQRScan = (data: string) => {
  //   setFormData({ ...formData, qrData: data, code: '' });
  //   setShowQRScanner(false);
  // };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            <CardTitle>Employee Registration</CardTitle>
          </div>
          <CardDescription>
            Register as an employee using an access code or QR code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Access Method</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formData.code ? 'default' : 'outline'}
                  onClick={() => {
                    setFormData({ ...formData, code: '', qrData: '' });
                  }}
                  className="flex-1"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Access Code
                </Button>
                <Button
                  type="button"
                  variant={formData.qrData ? 'default' : 'outline'}
                  onClick={() => setShowQRScanner(true)}
                  className="flex-1"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  QR Code
                </Button>
              </div>
            </div>

            {!formData.qrData && (
              <div>
                <Label htmlFor="code">Access Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter 6-digit access code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the 6-digit code provided by your employer
                </p>
              </div>
            )}

            {formData.qrData && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  QR code scanned successfully
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData({ ...formData, qrData: '' })}
                  className="mt-2"
                >
                  Clear QR Code
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#F37100] hover:bg-[#F37100]/90"
              disabled={loading || (!formData.code && !formData.qrData) || !formData.name}
            >
              {loading ? 'Registering...' : 'Register as Employee'}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/auth/login')}
              >
                Already registered? Log in
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


